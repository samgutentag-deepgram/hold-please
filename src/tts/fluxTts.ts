import type { Bus } from '../bus/events.ts'
import { now } from '../bus/clock.ts'
import { SAMPLE_RATE } from '../audio/leg.ts'
import { BACKOFF_MS, OPEN, openWebSocket, type SocketFactory, type SocketLike } from '../net/socket.ts'

// The Flux TTS socket, /v2/speak. Verified against developers.deepgram.com on 2026-09-10:
//   docs/flux-tts/client-messages, server-messages, interrupt-handling, state.
//
// Two facts that differ from the earlier API notes and matter for beat 1:
//   1. The server message is `SpeechInterrupted`, not `Interrupt`. `Interrupt` is what we send.
//   2. `text_spoken` is only present when our Interrupt carried a `playback_offset`, measured
//      in ms from the start of the session's audio. That is what PlaybackClock is for.

export const FLUX_TTS_URL = 'wss://api.deepgram.com/v2/speak'

export interface SpeechInterrupted {
  type: 'SpeechInterrupted'
  audio_played_ms: number
  text_spoken?: string
  text_remaining?: string
}
export interface SpeechMetadata {
  type: 'SpeechMetadata'
  speech_id: string
  audio_duration_ms: number
}
export interface SpeechStarted {
  type: 'SpeechStarted'
  speech_id: string
}
export type TtsServerMessage =
  | SpeechInterrupted
  | SpeechMetadata
  | SpeechStarted
  | { type: 'Connected' | 'Flushed' | 'SessionMetadata' | 'ConfigureSuccess' | 'ConfigureFailure' }
  | { type: 'Warning' | 'Error'; code: string; description: string }

export function buildTtsUrl(voice: string, base: string = FLUX_TTS_URL): string {
  const url = new URL(base)
  url.searchParams.set('model', voice)
  url.searchParams.set('encoding', 'linear16')
  url.searchParams.set('sample_rate', String(SAMPLE_RATE))
  return url.toString()
}

export interface FluxTtsOptions {
  apiKey: string
  voice: string
  bus: Bus
  createSocket?: SocketFactory
  baseUrl?: string
  clock?: () => number
}

export class FluxTts {
  private socket: SocketLike | null = null
  private closing = false
  private attempts = 0
  private audioListeners: Array<(pcm: Buffer) => void> = []
  private messageListeners: Array<(msg: TtsServerMessage) => void> = []
  private keepalive: NodeJS.Timeout | null = null

  // Turn timing for tts.firstByte.
  private turnId: string | null = null
  private turnStartedAt: number | null = null
  private awaitingFirstByte = false

  // After Interrupt, frames already on the wire keep arriving until SpeechInterrupted. Drop them.
  private discardAudio = false

  private readonly bus: Bus
  private readonly createSocket: SocketFactory
  private readonly baseUrl: string
  private readonly clock: () => number

  private readonly opts: FluxTtsOptions

  constructor(opts: FluxTtsOptions) {
    this.opts = opts
    this.bus = opts.bus
    this.createSocket = opts.createSocket ?? openWebSocket
    this.baseUrl = opts.baseUrl ?? FLUX_TTS_URL
    this.clock = opts.clock ?? now
  }

  onAudio(listener: (pcm: Buffer) => void): void {
    this.audioListeners.push(listener)
  }

  onMessage(listener: (msg: TtsServerMessage) => void): void {
    this.messageListeners.push(listener)
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const socket = this.createSocket(buildTtsUrl(this.opts.voice, this.baseUrl), {
        Authorization: `Token ${this.opts.apiKey}`,
      })
      this.socket = socket
      let settled = false

      socket.on('open', () => {
        if (this.attempts > 0) this.bus.emit({ kind: 'socket.recovered', which: 'tts', attempts: this.attempts })
        this.attempts = 0
        this.discardAudio = false
        this.startKeepalive(socket)
        if (!settled) {
          settled = true
          resolve()
        }
      })

      socket.on('message', (data, isBinary) => {
        if (isBinary) {
          this.handleAudio(data as Buffer)
          return
        }
        let msg: TtsServerMessage
        try {
          msg = JSON.parse(data.toString()) as TtsServerMessage
        } catch {
          return
        }
        this.handleMessage(msg)
      })

      socket.on('error', (err) => {
        console.error('[flux tts] socket error', err.message)
        if (!settled) {
          settled = true
          reject(err)
        }
      })

      socket.on('close', (code, reason) => {
        if (this.socket !== socket) return
        this.socket = null
        this.stopKeepalive()
        if (this.closing) return
        this.bus.emit({ kind: 'socket.degraded', which: 'tts', detail: `closed ${code} ${reason.toString()}`.trim() })
        this.scheduleReconnect()
      })
    })
  }

  /** Mark the start of an agent turn so the first audio frame can be timed against it. */
  beginTurn(turnId: string): void {
    this.turnId = turnId
    this.turnStartedAt = this.clock()
    this.awaitingFirstByte = true
    this.discardAudio = false
  }

  speak(text: string): void {
    if (!text) return
    this.send({ type: 'Speak', text })
  }

  flush(): void {
    this.send({ type: 'Flush' })
  }

  /** Barge-in. Stop playback locally first; this call is for the text_spoken reconciliation. */
  interrupt(playbackOffsetMs: number): void {
    this.discardAudio = true
    this.awaitingFirstByte = false
    this.send({ type: 'Interrupt', playback_offset: { type: 'time_ms', value: Math.max(0, Math.round(playbackOffsetMs)) } })
  }

  async close(): Promise<void> {
    this.closing = true
    this.stopKeepalive()
    const socket = this.socket
    if (!socket) return
    if (socket.readyState === OPEN) {
      socket.send(JSON.stringify({ type: 'Close' }))
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

  private send(message: Record<string, unknown>): void {
    if (!this.socket || this.socket.readyState !== OPEN) {
      console.error('[flux tts] dropped', message['type'], 'socket not open')
      return
    }
    this.socket.send(JSON.stringify(message))
  }

  private handleAudio(pcm: Buffer): void {
    if (this.discardAudio) return
    if (this.awaitingFirstByte && this.turnId && this.turnStartedAt !== null) {
      this.awaitingFirstByte = false
      this.bus.emit({ kind: 'tts.firstByte', turnId: this.turnId, ttfbMs: Math.round(this.clock() - this.turnStartedAt) })
    }
    for (const listener of this.audioListeners) listener(pcm)
  }

  private handleMessage(msg: TtsServerMessage): void {
    switch (msg.type) {
      case 'SpeechInterrupted':
        this.discardAudio = false
        this.bus.emit({ kind: 'tts.interrupt', textSpoken: msg.text_spoken ?? '' })
        break
      case 'Warning':
        // An ignored Interrupt means no SpeechInterrupted is coming, so stop discarding.
        if (msg.code === 'NO_AUDIO_GENERATED' || msg.code === 'INTERRUPT_IN_PROGRESS' || msg.code === 'INVALID_INTERRUPT_OFFSET') {
          this.discardAudio = false
        }
        console.error('[flux tts] warning', msg.code, msg.description)
        break
      case 'Error':
        this.bus.emit({ kind: 'socket.degraded', which: 'tts', detail: `${msg.code} ${msg.description}` })
        break
      default:
        break
    }
    for (const listener of this.messageListeners) listener(msg)
  }

  private startKeepalive(socket: SocketLike): void {
    this.stopKeepalive()
    // The server drops an idle session after 60 s. A ping resets the timer.
    this.keepalive = setInterval(() => {
      if (socket.readyState === OPEN) socket.ping?.()
    }, 25_000)
    this.keepalive.unref()
  }

  private stopKeepalive(): void {
    if (this.keepalive) clearInterval(this.keepalive)
    this.keepalive = null
  }

  private scheduleReconnect(): void {
    const delay = BACKOFF_MS[Math.min(this.attempts, BACKOFF_MS.length - 1)]!
    this.attempts += 1
    setTimeout(() => {
      if (this.closing) return
      this.connect().catch((err: Error) => {
        console.error('[flux tts] reconnect failed', err.message)
        this.scheduleReconnect()
      })
    }, delay).unref()
  }
}
