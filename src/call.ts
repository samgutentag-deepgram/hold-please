import type { Bus } from './bus/events.ts'
import type { Config } from './config.ts'
import type { AudioLeg } from './audio/leg.ts'
import { PlaybackClock } from './audio/playback.ts'
import { FluxStt, type FluxParams } from './stt/flux.ts'
import { FluxTts } from './tts/fluxTts.ts'
import { Llm } from './agent/llm.ts'
import { AgentLoop } from './agent/loop.ts'
import { SYSTEM_PROMPT } from './agent/prompt.ts'

// One call: one audio leg, one Flux STT socket, one Flux TTS socket, one LLM client, one loop.
// The demo runs one of these at a time, and then it is over.

export const DEFAULT_FLUX_PARAMS: Omit<FluxParams, 'model'> = {
  eotThreshold: 0.7,
  eotTimeoutMs: 5000,
  keyterms: [],
}

export class Call {
  readonly id: string
  readonly stt: FluxStt
  readonly tts: FluxTts
  readonly playback: PlaybackClock
  readonly loop: AgentLoop
  private ended = false
  private readonly leg: AudioLeg
  private readonly bus: Bus

  constructor(id: string, leg: AudioLeg, bus: Bus, config: Config) {
    this.id = id
    this.leg = leg
    this.bus = bus
    const apiKey = config.deepgram.apiKey
    if (!apiKey) throw new Error('DEEPGRAM_API_KEY is not set')

    this.playback = new PlaybackClock()
    this.stt = new FluxStt({ apiKey, bus, params: { model: config.deepgram.sttModel, ...DEFAULT_FLUX_PARAMS } })
    this.tts = new FluxTts({ apiKey, bus, voice: config.deepgram.ttsVoice })
    const llm = new Llm({ model: config.llm.model, system: SYSTEM_PROMPT, ...(config.llm.apiKey ? { apiKey: config.llm.apiKey } : {}) })
    this.loop = new AgentLoop({ bus, leg, stt: this.stt, tts: this.tts, llm, playback: this.playback })

    leg.onAudio((pcm) => this.stt.sendAudio(pcm))
    leg.onClose((reason) => void this.end(reason))
  }

  async start(): Promise<void> {
    this.bus.emit({ kind: 'call.started', callId: this.id })
    await Promise.all([this.stt.connect(), this.tts.connect()])
    this.loop.start()
  }

  async end(reason: string): Promise<void> {
    if (this.ended) return
    this.ended = true
    console.error(`[call ${this.id}] ending: ${reason}`)
    this.loop.stop()
    await Promise.allSettled([this.stt.close(), this.tts.close(), this.leg.close()])
    this.bus.emit({ kind: 'call.ended', callId: this.id })
  }
}
