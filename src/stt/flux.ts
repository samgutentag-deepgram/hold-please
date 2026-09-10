import type { Bus } from '../bus/events.ts'
import { now } from '../bus/clock.ts'
import { BYTES_PER_SAMPLE, SAMPLE_RATE } from '../audio/leg.ts'
import { BACKOFF_MS, OPEN, openWebSocket, type SocketFactory, type SocketLike } from '../net/socket.ts'

// The Flux STT socket, /v2/listen. Verified against developers.deepgram.com on 2026-09-10:
//   docs/flux/quickstart, docs/flux/state, docs/flux/configure, docs/flux/close-stream.
//
// The thing that matters most here is configure(): it changes keyterms and thresholds on the
// live socket via the Configure control message. No reconnect. Beat 2 depends on it.

export const FLUX_URL = 'wss://api.deepgram.com/v2/listen'

export interface FluxParams {
  model: string
  eotThreshold: number
  eotTimeoutMs: number
  eagerEotThreshold?: number
  keyterms: string[]
  languageHints?: string[]
}

export type ConfigurableParams = Partial<Omit<FluxParams, 'model'>>

export interface FluxWord {
  word: string
  confidence: number
  start: number
  end: number
}

export type TurnEvent = 'StartOfTurn' | 'Update' | 'EagerEndOfTurn' | 'TurnResumed' | 'EndOfTurn'

export interface TurnInfo {
  type: 'TurnInfo'
  event: TurnEvent
  turn_index: number
  transcript: string
  words: FluxWord[]
  end_of_turn_confidence: number
  audio_window_start: number
  audio_window_end: number
  languages?: string[]
  trigger?: 'model' | 'manual' | 'timeout'
}

interface ServerMessage {
  type: string
  [key: string]: unknown
}

export function validateParams(p: Pick<FluxParams, 'eotThreshold' | 'eotTimeoutMs' | 'eagerEotThreshold'>): string | null {
  if (p.eotThreshold < 0.5 || p.eotThreshold > 1.0) return `eot_threshold ${p.eotThreshold} is outside 0.5 to 1.0`
  if (p.eotTimeoutMs < 500 || p.eotTimeoutMs > 60_000) return `eot_timeout_ms ${p.eotTimeoutMs} is outside 500 to 60000`
  if (p.eagerEotThreshold !== undefined) {
    if (p.eagerEotThreshold < 0.3 || p.eagerEotThreshold > 0.9) return `eager_eot_threshold ${p.eagerEotThreshold} is outside 0.3 to 0.9`
    if (p.eagerEotThreshold > p.eotThreshold) return `eager_eot_threshold ${p.eagerEotThreshold} must be <= eot_threshold ${p.eotThreshold}`
  }
  return null
}

export function buildFluxUrl(params: FluxParams, base: string = FLUX_URL): string {
  const url = new URL(base)
  url.searchParams.set('model', params.model)
  url.searchParams.set('encoding', 'linear16')
  url.searchParams.set('sample_rate', String(SAMPLE_RATE))
  url.searchParams.set('eot_threshold', String(params.eotThreshold))
  url.searchParams.set('eot_timeout_ms', String(params.eotTimeoutMs))
  if (params.eagerEotThreshold !== undefined) url.searchParams.set('eager_eot_threshold', String(params.eagerEotThreshold))
  for (const term of params.keyterms) url.searchParams.append('keyterm', term)
  for (const hint of params.languageHints ?? []) url.searchParams.append('language_hint', hint)
  return url.toString()
}

export interface FluxSttOptions {
  apiKey: string
  params: FluxParams
  bus: Bus
  createSocket?: SocketFactory
  baseUrl?: string
  clock?: () => number
}

type TurnListener = (info: TurnInfo) => void

export class FluxStt {
  readonly params: FluxParams
  private socket: SocketLike | null = null
  private closing = false
  private attempts = 0
  private turnListeners: TurnListener[] = []
  private pendingConfigure: { resolve: (r: { ok: boolean; detail?: string }) => void; timer: NodeJS.Timeout } | null = null
  private lastLanguages = ''
  /** When the current socket connected, for the uptime counter that proves no reconnect. */
  connectedAt: number | null = null

  // For end-of-turn latency: how much audio we have sent, and when each chunk went out.
  private sentSeconds = 0
  private sentLog: Array<{ audioEnd: number; t: number }> = []

  private readonly bus: Bus
  private readonly createSocket: SocketFactory
  private readonly baseUrl: string
  private readonly clock: () => number

  private readonly opts: FluxSttOptions

  constructor(opts: FluxSttOptions) {
    this.opts = opts
    const problem = validateParams(opts.params)
    if (problem) throw new Error(`invalid Flux params: ${problem}`)
    this.params = { ...opts.params, keyterms: [...opts.params.keyterms] }
    this.bus = opts.bus
    this.createSocket = opts.createSocket ?? openWebSocket
    this.baseUrl = opts.baseUrl ?? FLUX_URL
    this.clock = opts.clock ?? now
  }

  onTurn(listener: TurnListener): void {
    this.turnListeners.push(listener)
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const url = buildFluxUrl(this.params, this.baseUrl)
      const socket = this.createSocket(url, { Authorization: `Token ${this.opts.apiKey}` })
      this.socket = socket
      let settled = false

      socket.on('open', () => {
        this.connectedAt = this.clock()
        this.sentSeconds = 0
        this.sentLog = []
        if (this.attempts > 0) {
          this.bus.emit({ kind: 'socket.recovered', which: 'stt', attempts: this.attempts })
        }
        this.attempts = 0
        if (!settled) {
          settled = true
          resolve()
        }
      })

      socket.on('message', (data, isBinary) => {
        if (isBinary) return
        let msg: ServerMessage
        try {
          msg = JSON.parse(data.toString()) as ServerMessage
        } catch {
          return
        }
        this.handleMessage(msg)
      })

      socket.on('error', (err) => {
        console.error('[flux stt] socket error', err.message)
        if (!settled) {
          settled = true
          reject(err)
        }
      })

      socket.on('close', (code, reason) => {
        if (this.socket !== socket) return
        this.socket = null
        this.connectedAt = null
        this.failPendingConfigure('socket closed')
        if (this.closing) return
        this.bus.emit({ kind: 'socket.degraded', which: 'stt', detail: `closed ${code} ${reason.toString()}`.trim() })
        this.scheduleReconnect()
      })
    })
  }

  sendAudio(pcm: Buffer): void {
    if (!this.socket || this.socket.readyState !== OPEN) return
    this.socket.send(pcm)
    this.sentSeconds += pcm.length / (SAMPLE_RATE * BYTES_PER_SAMPLE)
    const t = this.clock()
    this.sentLog.push({ audioEnd: this.sentSeconds, t })
    // Keep about 30 s of history. 20 ms frames means 50 entries a second.
    if (this.sentLog.length > 1500) this.sentLog.splice(0, this.sentLog.length - 1500)
  }

  /**
   * Change keyterms, thresholds, or language hints on the open socket. Resolves when Flux
   * acknowledges. Emits config.applied with reconnected: false, which is the beat 2 proof.
   */
  configure(partial: ConfigurableParams): Promise<{ ok: boolean; detail?: string }> {
    const next: FluxParams = { ...this.params, ...stripUndefined(partial) }
    if (partial.keyterms) next.keyterms = [...partial.keyterms]
    const problem = validateParams(next)
    if (problem) return Promise.resolve({ ok: false, detail: problem })

    if (!this.socket || this.socket.readyState !== OPEN) {
      // Nothing to configure live; the new params ride along on the next (re)connect.
      Object.assign(this.params, next)
      return Promise.resolve({ ok: false, detail: 'socket not open, applied for next connect' })
    }

    const message: Record<string, unknown> = { type: 'Configure' }
    const fields: string[] = []
    if (partial.keyterms !== undefined) {
      message['keyterms'] = next.keyterms
      fields.push('keyterms')
    }
    if (partial.languageHints !== undefined) {
      message['language_hints'] = next.languageHints ?? []
      fields.push('language_hints')
    }
    const thresholds: Record<string, number> = {}
    if (partial.eotThreshold !== undefined) {
      thresholds['eot_threshold'] = next.eotThreshold
      fields.push('eot_threshold')
    }
    if (partial.eotTimeoutMs !== undefined) {
      thresholds['eot_timeout_ms'] = next.eotTimeoutMs
      fields.push('eot_timeout_ms')
    }
    if (partial.eagerEotThreshold !== undefined && next.eagerEotThreshold !== undefined) {
      thresholds['eager_eot_threshold'] = next.eagerEotThreshold
      fields.push('eager_eot_threshold')
    }
    if (Object.keys(thresholds).length) message['thresholds'] = thresholds
    if (!fields.length) return Promise.resolve({ ok: true, detail: 'nothing to change' })

    this.failPendingConfigure('superseded')
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.pendingConfigure = null
        resolve({ ok: false, detail: 'no ConfigureSuccess within 5 s' })
      }, 5000)
      this.pendingConfigure = {
        timer,
        resolve: (result) => {
          if (result.ok) {
            Object.assign(this.params, next)
            this.bus.emit({ kind: 'config.applied', reconnected: false, fields })
          }
          resolve(result)
        },
      }
      this.socket!.send(JSON.stringify(message))
    })
  }

  async close(): Promise<void> {
    this.closing = true
    const socket = this.socket
    if (!socket) return
    if (socket.readyState === OPEN) {
      socket.send(JSON.stringify({ type: 'CloseStream' }))
      // Flux closes from its side after draining. Do not wait on it forever.
      await new Promise<void>((resolve) => {
        const timer = setTimeout(() => {
          socket.close()
          resolve()
        }, 1500)
        socket.on('close', () => {
          clearTimeout(timer)
          resolve()
        })
      })
    } else {
      socket.close()
    }
  }

  private handleMessage(msg: ServerMessage): void {
    switch (msg.type) {
      case 'Connected':
        return
      case 'TurnInfo':
        this.handleTurn(msg as unknown as TurnInfo)
        return
      case 'ConfigureSuccess':
        this.settlePendingConfigure({ ok: true })
        return
      case 'ConfigureFailure':
        this.settlePendingConfigure({ ok: false, detail: String(msg['description'] ?? msg['message'] ?? 'ConfigureFailure') })
        return
      case 'Error':
        this.bus.emit({ kind: 'socket.degraded', which: 'stt', detail: String(msg['description'] ?? msg['message'] ?? 'Flux error') })
        return
      default:
        return
    }
  }

  private handleTurn(info: TurnInfo): void {
    switch (info.event) {
      case 'StartOfTurn':
        this.bus.emit({ kind: 'stt.startOfTurn' })
        break
      case 'Update':
        this.bus.emit({ kind: 'stt.update', text: info.transcript, eotConfidence: info.end_of_turn_confidence })
        break
      case 'EagerEndOfTurn':
        this.bus.emit({ kind: 'stt.eagerEndOfTurn', text: info.transcript })
        break
      case 'TurnResumed':
        this.bus.emit({ kind: 'stt.turnResumed' })
        break
      case 'EndOfTurn':
        this.bus.emit({ kind: 'stt.endOfTurn', text: info.transcript, latencyMs: this.endOfTurnLatency(info) })
        break
    }
    if (info.languages && info.languages.length) {
      const key = info.languages.join(',')
      if (key !== this.lastLanguages) {
        this.lastLanguages = key
        this.bus.emit({ kind: 'stt.languages', languages: info.languages })
      }
    }
    for (const listener of this.turnListeners) listener(info)
  }

  /**
   * Time from the last word's audio leaving us to the EndOfTurn arriving. Honest about what it
   * measures: it includes the network hop, and it is what the caller experiences as the pause.
   */
  private endOfTurnLatency(info: TurnInfo): number {
    const lastWord = info.words.at(-1)
    const target = lastWord ? lastWord.end : info.audio_window_end
    const entry = this.sentLog.find((e) => e.audioEnd >= target) ?? this.sentLog.at(-1)
    if (!entry) return 0
    return Math.max(0, Math.round(this.clock() - entry.t))
  }

  private settlePendingConfigure(result: { ok: boolean; detail?: string }): void {
    const pending = this.pendingConfigure
    if (!pending) return
    clearTimeout(pending.timer)
    this.pendingConfigure = null
    pending.resolve(result)
  }

  private failPendingConfigure(detail: string): void {
    this.settlePendingConfigure({ ok: false, detail })
  }

  private scheduleReconnect(): void {
    const delay = BACKOFF_MS[Math.min(this.attempts, BACKOFF_MS.length - 1)]!
    this.attempts += 1
    setTimeout(() => {
      if (this.closing) return
      this.connect().catch((err: Error) => {
        console.error('[flux stt] reconnect failed', err.message)
        this.scheduleReconnect()
      })
    }, delay).unref()
  }
}

function stripUndefined<T extends object>(obj: T): Partial<T> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as Partial<T>
}
