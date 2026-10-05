import { loadConfig } from './config.ts'
import { bus } from './bus/events.ts'
import { startWebServer } from './web/server.ts'
import { Call } from './call.ts'
import { LocalAudioLeg } from './audio/local.ts'
import { resolveMic, resolveSpeaker } from './audio/devices.ts'
import { createVonageWebhooks, VONAGE_WS_PATH, VonageAudioLeg } from './telephony/vonage.ts'
import { DEFAULT_TOGGLES, TOGGLE_LIMITS, ToggleStore, type Toggles } from './toggles/state.ts'
import { BEATS, SCRIPT, togglesForStep } from './agent/script.ts'
import { codeCards } from './toggles/cards.ts'

// Degrade, never crash. An unhandled error on a projector is worse than a degraded state, so
// both handlers log loudly and keep the process alive.
process.on('unhandledRejection', (reason) => {
  console.error('[process] unhandled rejection', reason)
})
process.on('uncaughtException', (err) => {
  console.error('[process] uncaught exception', err)
})

// The console is the second consumer of the bus, after the dashboard. One JSON line per event,
// so a terminal log can be diffed against what the browser showed.
bus.on((event) => {
  console.log(JSON.stringify(event))
})

async function main(): Promise<void> {
  const config = loadConfig()
  const local = process.argv.includes('--local')
  // Local calls wait for the Start button so the presenter sets the timing, not the terminal.
  // --autostart restores the old behavior of dialing in the moment the process is up.
  const autostart = process.argv.includes('--autostart')
  let activeCall: Call | null = null
  let localBlocked: string | null = null
  let localStarting = false
  let micMuted = false
  const toggles = new ToggleStore(bus)

  // Order matters: eager rides on smart, and eager's threshold may never exceed eot's.
  const SET_ORDER = ['eagerEot', 'smartEot', 'bargeIn', 'keyterms', 'multilingual', 'eagerEotThreshold', 'eotThreshold', 'eotTimeoutMs'] as const
  const applyToggles = (target: Partial<Toggles>): void => {
    const want = { ...DEFAULT_TOGGLES, ...target }
    for (const name of SET_ORDER) toggles.set(name, want[name])
  }

  const startLocalCall = async (): Promise<void> => {
    if (activeCall || localStarting) return
    localStarting = true
    try {
      const [mic, speaker] = await Promise.all([
        resolveMic(config.local.micDevice),
        resolveSpeaker(config.local.speakerDevice),
      ])
      const leg = new LocalAudioLeg({
        micDevice: mic.spec,
        speakerDeviceIndex: speaker.index,
        muteWhileSpeaking: config.local.muteWhileSpeaking,
        isPlaying: () => activeCall?.playback.isPlaying() ?? false,
        isMuted: () => micMuted,
        bus,
      })
      console.log(`[local] microphone ${mic.label}, speaker ${speaker.label}.`)
      // Every new call starts clean: all switches off, sliders at their defaults.
      applyToggles({})
      const call = new Call(`local-${Date.now()}`, leg, bus, config, toggles)
      activeCall = call
      leg.onClose(() => {
        if (activeCall === call) activeCall = null
      })
      // A call always starts listening. A mute left on from the last run would make the agent
      // deaf on the first line of the next one.
      if (micMuted) {
        micMuted = false
        bus.emit({ kind: 'mic.muted', muted: false })
      }
      leg.start()
      await call.start()
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      bus.emit({ kind: 'socket.degraded', which: 'stt', detail: `local call failed to start: ${message}` })
      // No Call yet means no call.ended either, and the dashboard's button would stay disabled.
      if (activeCall) await activeCall.end(message)
      else bus.emit({ kind: 'call.ended', callId: 'local' })
      activeCall = null
    } finally {
      localStarting = false
    }
  }

  if (!config.deepgram.apiKey) {
    console.error('[config] DEEPGRAM_API_KEY is not set. The dashboard will run; calls will fail visibly.')
  }
  if (config.llm.provider !== 'anthropic') {
    throw new Error(`LLM_PROVIDER=${config.llm.provider} is not supported; this build speaks to one provider`)
  }

  const web = await startWebServer({
    port: config.port,
    host: config.host,
    bus,
    handlers: [createVonageWebhooks({ publicUrl: () => config.publicUrl, bus })],
    snapshot: () => ({ toggles: toggles.get(), defaults: DEFAULT_TOGGLES, limits: TOGGLE_LIMITS, keyterms: config.demo.keyterms, cards: codeCards(config.demo.keyterms), script: SCRIPT.map((s) => ({ beat: s.beat, label: s.label })), beats: BEATS, local, callActive: activeCall !== null, micMuted }),
    onCommand: (command) => {
      if (command.type === 'mic.toggle') {
        micMuted = !micMuted
        bus.emit({ kind: 'mic.muted', muted: micMuted })
        return undefined
      }
      if (command.type === 'agent.hush') {
        activeCall?.loop.hush()
        return undefined
      }
      if (command.type === 'agent.seek') {
        const step = Number(command['step'])
        if (!Number.isInteger(step) || step < 0 || step >= SCRIPT.length) return { type: 'error', reason: 'no such step' }
        void (async () => {
          if (!activeCall && local) await startLocalCall()
          if (!activeCall) return
          bus.emit({ kind: 'agent.seeked', step, caller: SCRIPT[step - 1]?.caller ?? '' })
          activeCall.loop.seek(step)
          applyToggles(togglesForStep(step))
        })()
        return undefined
      }
      if (command.type === 'agent.rewind') {
        activeCall?.loop.rewind()
        return undefined
      }
      if (command.type === 'call.start' || command.type === 'call.end') {
        if (!local) return { type: 'call.rejected', reason: 'calls come in on the Vonage number in this mode' }
        if (command.type === 'call.start') {
          if (localBlocked) return { type: 'call.rejected', reason: localBlocked }
          void startLocalCall()
        } else {
          void activeCall?.end('ended from the dashboard')
        }
        return undefined
      }
      if (command.type === 'toggle') {
        const result = toggles.set(String(command['name']), command['value'])
        return result.ok
          ? { type: 'toggles', toggles: result.toggles }
          : { type: 'toggle.rejected', name: command['name'], reason: result.reason }
      }
      return { type: 'error', reason: `unknown command ${command.type}` }
    },
    upgrades: {
      [VONAGE_WS_PATH]: (ws, req) => {
        if (activeCall) {
          // One call at a time is the whole requirement. A second caller gets a busy signal.
          console.error('[vonage] rejecting a second concurrent call')
          ws.close(1013, 'busy')
          return
        }
        const leg = new VonageAudioLeg(ws)
        const id = new URL(req.url ?? '/', 'http://localhost').searchParams.get('callId') ?? `vonage-${Date.now()}`
        const call = new Call(id, leg, bus, config, toggles)
        activeCall = call
        leg.onClose(() => {
          if (activeCall === call) activeCall = null
        })
        call.start().catch((err: Error) => {
          bus.emit({ kind: 'socket.degraded', which: 'vonage', detail: `call failed to start: ${err.message}` })
          void call.end(err.message)
        })
      },
    },
  })

  bus.emit({ kind: 'process.started', port: config.port, host: config.host })
  console.error(`[web] dashboard at http://${config.host}:${config.port}`)
  if (!local && !config.publicUrl) {
    console.error('[vonage] PUBLIC_URL is unset; inbound calls cannot reach this process until it is')
  }

  if (local) {
    // Check the keys before touching an audio device. This is the command the README's
    // quickstart tells a first-time reader to run, and it used to throw an unhandled error
    // with absolute paths in it when a key was missing. Say what is wrong and keep the
    // dashboard up, which is the same rule the rest of the app follows.
    const missing = [
      config.deepgram.apiKey ? null : 'DEEPGRAM_API_KEY',
      config.llm.apiKey ? null : 'ANTHROPIC_API_KEY (or LLM_API_KEY)',
    ].filter((n): n is string => n !== null)
    if (missing.length > 0) {
      console.error(
        `\n[local] Cannot start a call: ${missing.join(' and ')} ${missing.length > 1 ? 'are' : 'is'} not set.\n` +
        `[local] Copy sample.env to .env and fill those in, then run this again.\n` +
        `[local] The dashboard is still up at http://${config.host}:${config.port} if you want to look around.\n`,
      )
      bus.emit({
        kind: 'socket.degraded',
        which: 'stt',
        detail: `${missing.join(' and ')} not set. See the README quickstart.`,
      })
      localBlocked = `${missing.join(' and ')} not set`
    } else {
      console.error('[local] wear headphones, or set LOCAL_MUTE_WHILE_SPEAKING=1, or it hears itself.')
      if (autostart) await startLocalCall()
      else console.error('[local] press Start call on the dashboard when you are ready.')
    }
  }

  const shutdown = (signal: NodeJS.Signals) => {
    console.error(`[process] ${signal}, shutting down`)
    const pending = activeCall ? activeCall.end(signal) : Promise.resolve()
    pending.then(() => web.close()).then(() => process.exit(0))
    setTimeout(() => process.exit(1), 3000).unref()
  }
  process.once('SIGINT', shutdown)
  process.once('SIGTERM', shutdown)
}

main().catch((err: unknown) => {
  console.error('[process] failed to start', err)
  process.exit(1)
})
