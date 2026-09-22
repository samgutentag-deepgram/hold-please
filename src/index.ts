import { loadConfig } from './config.ts'
import { bus } from './bus/events.ts'
import { startWebServer } from './web/server.ts'
import { Call } from './call.ts'
import { LocalAudioLeg } from './audio/local.ts'
import { resolveMic, resolveSpeaker } from './audio/devices.ts'
import { createVonageWebhooks, VONAGE_WS_PATH, VonageAudioLeg } from './telephony/vonage.ts'
import { DEFAULT_TOGGLES, TOGGLE_LIMITS, ToggleStore } from './toggles/state.ts'

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
  let activeCall: Call | null = null
  const toggles = new ToggleStore(bus)

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
    snapshot: () => ({ toggles: toggles.get(), defaults: DEFAULT_TOGGLES, limits: TOGGLE_LIMITS, keyterms: config.demo.keyterms }),
    onCommand: (command) => {
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
      return
    }

    const [mic, speaker] = await Promise.all([
      resolveMic(config.local.micDevice),
      resolveSpeaker(config.local.speakerDevice),
    ])
    const leg = new LocalAudioLeg({
      micDevice: mic.spec,
      speakerDeviceIndex: speaker.index,
      muteWhileSpeaking: config.local.muteWhileSpeaking,
      isPlaying: () => activeCall?.playback.isPlaying() ?? false,
      bus,
    })
    console.log(`[local] microphone ${mic.label}, speaker ${speaker.label}.`)
    const call = new Call('local', leg, bus, config, toggles)
    activeCall = call
    leg.onClose(() => {
      activeCall = null
    })
    console.error('[local] wear headphones, or set LOCAL_MUTE_WHILE_SPEAKING=1, or it hears itself.')
    leg.start()
    await call.start()
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
