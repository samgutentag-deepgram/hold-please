import { now } from '../bus/clock.ts'
import { BYTES_PER_SAMPLE, SAMPLE_RATE } from './leg.ts'

// How much agent audio the caller has actually heard, session-wide, in milliseconds.
//
// The far side (Vonage, or the local speaker) plays audio in real time as it arrives and
// buffers anything we send faster than that. So at any instant the caller has heard the
// smaller of "what we sent" and "how long playback has been running". Flux TTS's Interrupt
// needs this number as `playback_offset` to compute `text_spoken`, and it must be session-wide
// and never decrease across interrupts, so this clock is never reset per turn.
export class PlaybackClock {
  private readonly bytesPerMs: number
  private basePlayedMs = 0
  private runStartedAt: number | null = null
  private runQueuedMs = 0

  private readonly clock: () => number

  constructor(clock: () => number = now, sampleRate: number = SAMPLE_RATE) {
    this.clock = clock
    this.bytesPerMs = (sampleRate * BYTES_PER_SAMPLE) / 1000
  }

  push(bytes: number): void {
    const t = this.clock()
    if (this.runStartedAt === null || this.remainingMs(t) <= 0) {
      // The buffer had drained, so this audio starts a new real-time run.
      this.basePlayedMs = this.playedMs(t)
      this.runStartedAt = t
      this.runQueuedMs = 0
    }
    this.runQueuedMs += bytes / this.bytesPerMs
  }

  /** Milliseconds of agent audio heard so far this session. Monotonic. */
  playedMs(t: number = this.clock()): number {
    if (this.runStartedAt === null) return Math.round(this.basePlayedMs)
    const elapsed = Math.max(0, t - this.runStartedAt)
    return Math.round(this.basePlayedMs + Math.min(this.runQueuedMs, elapsed))
  }

  /** Milliseconds still buffered on the far side. */
  remainingMs(t: number = this.clock()): number {
    if (this.runStartedAt === null) return 0
    return Math.max(0, this.runQueuedMs - (t - this.runStartedAt))
  }

  isPlaying(t: number = this.clock()): boolean {
    return this.remainingMs(t) > 0
  }

  /** Barge-in: what was heard stays counted, what was buffered is gone. */
  clear(): void {
    const t = this.clock()
    this.basePlayedMs = this.playedMs(t)
    this.runStartedAt = null
    this.runQueuedMs = 0
  }
}
