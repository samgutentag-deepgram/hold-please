import type { Bus } from './bus/events.ts'
import type { Config } from './config.ts'
import type { AudioLeg } from './audio/leg.ts'
import { PlaybackClock } from './audio/playback.ts'
import { FluxStt, type ConfigurableParams, type FluxParams } from './stt/flux.ts'
import { FluxTts } from './tts/fluxTts.ts'
import { Llm } from './agent/llm.ts'
import { AgentLoop } from './agent/loop.ts'
import { SYSTEM_PROMPT } from './agent/prompt.ts'
import type { ToggleName, Toggles, ToggleStore } from './toggles/state.ts'
import { Recorder } from './debug/recorder.ts'

// One call: one audio leg, one Flux STT socket, one Flux TTS socket, one LLM client, one loop.
// The demo runs one of these at a time, and then it is over.
//
// Toggles reach the sockets from here. Every change except `multilingual` goes through
// stt.configure() on the open socket and produces config.applied { reconnected: false }.

export function sttModelFor(toggles: Readonly<Toggles>, base: string): string {
  return toggles.multilingual ? 'flux-general-multi' : base
}

/** What Flux should be told, given the toggles. Naive mode strips keyterms and eager. */
export function fluxParamsFor(toggles: Readonly<Toggles>, model: string, keyterms: string[]): FluxParams {
  const params: FluxParams = {
    model,
    eotThreshold: toggles.eotThreshold,
    eotTimeoutMs: toggles.eotTimeoutMs,
    keyterms: toggles.keyterms ? [...keyterms] : [],
  }
  if (toggles.eagerEot && toggles.smartEot) params.eagerEotThreshold = toggles.eagerEotThreshold
  return params
}

export class Call {
  readonly id: string
  private sttSocket: FluxStt
  readonly tts: FluxTts
  readonly playback: PlaybackClock
  readonly loop: AgentLoop
  private ended = false
  private readonly leg: AudioLeg
  private readonly bus: Bus
  private readonly config: Config
  private readonly toggles: ToggleStore
  private unsubscribeToggles: (() => void) | null = null
  private recorder: Recorder | null = null

  constructor(id: string, leg: AudioLeg, bus: Bus, config: Config, toggles: ToggleStore) {
    this.id = id
    this.leg = leg
    this.bus = bus
    this.config = config
    this.toggles = toggles
    const apiKey = config.deepgram.apiKey
    if (!apiKey) throw new Error('DEEPGRAM_API_KEY is not set')

    const t = toggles.get()
    this.playback = new PlaybackClock()
    this.sttSocket = new FluxStt({
      apiKey,
      bus,
      params: fluxParamsFor(t, sttModelFor(t, config.deepgram.sttModel), config.demo.keyterms),
    })
    this.tts = new FluxTts({ apiKey, bus, voice: config.deepgram.ttsVoice })
    const llm = new Llm({ model: config.llm.model, system: SYSTEM_PROMPT, ...(config.llm.apiKey ? { apiKey: config.llm.apiKey } : {}) })
    this.loop = new AgentLoop({ bus, leg, stt: this.sttSocket, tts: this.tts, llm, playback: this.playback, toggles: () => toggles.get() })

    if (process.env['RECORD'] !== '0') this.recorder = new Recorder(bus, id)
    // One forwarding listener that always targets the current socket, even after a swap.
    leg.onAudio((pcm) => {
      this.recorder?.audio(pcm)
      this.sttSocket.sendAudio(pcm)
    })
    leg.onClose((reason) => void this.end(reason))
  }

  get stt(): FluxStt {
    return this.sttSocket
  }

  async start(): Promise<void> {
    this.bus.emit({ kind: 'call.started', callId: this.id })
    await Promise.all([this.stt.connect(), this.tts.connect()])
    this.unsubscribeToggles = this.toggles.onChange((next, changed, previous) => void this.applyToggle(next, changed, previous))
    this.loop.start()
  }

  /** Push a toggle change to the live Flux socket. */
  private async applyToggle(next: Toggles, changed: ToggleName, previous: Toggles): Promise<void> {
    if (this.ended) return
    const keyterms = this.config.demo.keyterms
    const before = fluxParamsFor(previous, this.stt.params.model, keyterms)
    const after = fluxParamsFor(next, this.stt.params.model, keyterms)

    if (changed === 'multilingual') {
      // The model is a connection parameter. This is the one toggle that has to reconnect,
      // and it says so on the bus rather than pretending.
      const wanted = sttModelFor(next, this.config.deepgram.sttModel)
      if (wanted === this.stt.params.model) return
      await this.sttSocket.close()
      const replacement = new FluxStt({ apiKey: this.config.deepgram.apiKey!, bus: this.bus, params: { ...after, model: wanted } })
      this.sttSocket = replacement
      this.loop.attachStt(replacement)
      await replacement.connect()
      this.bus.emit({ kind: 'config.applied', reconnected: true, fields: ['model'] })
      return
    }

    const partial: ConfigurableParams = {}
    if (JSON.stringify(before.keyterms) !== JSON.stringify(after.keyterms)) partial.keyterms = after.keyterms
    if (before.eotThreshold !== after.eotThreshold) partial.eotThreshold = after.eotThreshold
    if (before.eotTimeoutMs !== after.eotTimeoutMs) partial.eotTimeoutMs = after.eotTimeoutMs
    if (before.eagerEotThreshold !== after.eagerEotThreshold && after.eagerEotThreshold !== undefined) {
      partial.eagerEotThreshold = after.eagerEotThreshold
    }
    if (!Object.keys(partial).length) return
    const result = await this.stt.configure(partial)
    if (!result.ok) {
      this.bus.emit({ kind: 'socket.degraded', which: 'stt', detail: `configure rejected: ${result.detail ?? 'unknown'}` })
    }
  }

  async end(reason: string): Promise<void> {
    if (this.ended) return
    this.ended = true
    this.unsubscribeToggles?.()
    console.error(`[call ${this.id}] ending: ${reason}`)
    this.loop.stop()
    await Promise.allSettled([this.stt.close(), this.tts.close(), this.leg.close()])
    this.bus.emit({ kind: 'call.ended', callId: this.id })
    this.recorder?.close()
  }
}
