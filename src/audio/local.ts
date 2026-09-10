import { spawn, type ChildProcessByStdio } from 'node:child_process'
import type { Readable, Writable } from 'node:stream'
import { now } from '../bus/clock.ts'
import { FRAME_BYTES, FRAME_MS, Framer, SAMPLE_RATE, type AudioLeg } from './leg.ts'

// The local harness: microphone in, speakers out, via ffmpeg, so Phases 1 to 5 can be developed
// without a phone. The one thing it cannot prove is the telephony leg itself.
//
// Playback is one ffmpeg process for the whole call, fed exactly one 20 ms frame every 20 ms,
// silence when there is nothing to say. That keeps the audio device warm (a cold device swallows
// the first frames of every reply), keeps the pipe buffer at one frame so clear() is immediate,
// and behaves the way Vonage does: real-time playback of whatever we have queued.

type Capture = ChildProcessByStdio<null, Readable, Readable>
type Player = ChildProcessByStdio<Writable, null, Readable>

const SILENCE = Buffer.alloc(FRAME_BYTES)

export interface LocalLegOptions {
  micDevice: string
  speakerDeviceIndex: number
  muteWhileSpeaking: boolean
  isPlaying: () => boolean
}

export class LocalAudioLeg implements AudioLeg {
  readonly name = 'local' as const
  private capture: Capture | null = null
  private player: Player | null = null
  private pacer: NodeJS.Timeout | null = null
  private readonly inFramer = new Framer(FRAME_BYTES)
  private readonly outFramer = new Framer(FRAME_BYTES)
  private outQueue: Buffer[] = []
  private audioListeners: Array<(pcm: Buffer) => void> = []
  private closeListeners: Array<(reason: string) => void> = []
  private closed = false
  private readonly opts: LocalLegOptions

  constructor(opts: LocalLegOptions) {
    this.opts = opts
  }

  start(): void {
    this.startCapture()
    this.startPlayer()
  }

  onAudio(listener: (pcm: Buffer) => void): void {
    this.audioListeners.push(listener)
  }

  send(pcm: Buffer): void {
    if (this.closed) return
    for (const frame of this.outFramer.push(pcm)) this.outQueue.push(frame)
  }

  clear(): void {
    this.outQueue = []
    this.outFramer.reset()
  }

  onClose(listener: (reason: string) => void): void {
    this.closeListeners.push(listener)
  }

  async close(): Promise<void> {
    this.finish('closed')
  }

  private startCapture(): void {
    const capture = spawn(
      'ffmpeg',
      [
        '-hide_banner', '-loglevel', 'error',
        '-f', 'avfoundation', '-i', this.opts.micDevice,
        '-f', 's16le', '-ar', String(SAMPLE_RATE), '-ac', '1', '-',
      ],
      { stdio: ['ignore', 'pipe', 'pipe'] },
    )
    this.capture = capture
    capture.stdout.on('data', (chunk: Buffer) => {
      if (this.opts.muteWhileSpeaking && this.opts.isPlaying()) return
      for (const frame of this.inFramer.push(chunk)) {
        for (const listener of this.audioListeners) listener(frame)
      }
    })
    capture.stderr.on('data', (chunk: Buffer) => console.error('[local mic]', chunk.toString().trim()))
    capture.on('exit', (code) => {
      if (!this.closed) this.finish(`microphone capture exited with code ${code}`)
    })
    capture.on('error', (err) => this.finish(`ffmpeg failed to start: ${err.message}`))
  }

  private startPlayer(): void {
    const player = spawn(
      'ffmpeg',
      [
        '-hide_banner', '-loglevel', 'error',
        '-fflags', 'nobuffer', '-flags', 'low_delay',
        '-f', 's16le', '-ar', String(SAMPLE_RATE), '-ac', '1', '-i', 'pipe:0',
        '-f', 'audiotoolbox', '-audio_device_index', String(this.opts.speakerDeviceIndex), '-',
      ],
      { stdio: ['pipe', 'ignore', 'pipe'] },
    )
    this.player = player
    player.stderr.on('data', (chunk: Buffer) => console.error('[local speaker]', chunk.toString().trim()))
    player.stdin.on('error', (err) => console.error('[local speaker] pipe', err.message))
    player.on('exit', (code) => {
      if (!this.closed) this.finish(`speaker playback exited with code ${code}`)
    })

    // Self-correcting pacer: write however many frames are due since start, silence if the
    // queue is empty, capped so a stalled event loop does not dump a burst on the device.
    const startedAt = now()
    let written = 0
    this.pacer = setInterval(() => {
      const due = Math.floor((now() - startedAt) / FRAME_MS) - written
      const count = Math.min(Math.max(due, 0), 5)
      for (let i = 0; i < count; i++) {
        const frame = this.outQueue.shift() ?? SILENCE
        if (!player.stdin.destroyed) player.stdin.write(frame)
        written += 1
      }
    }, FRAME_MS / 2)
  }

  private finish(reason: string): void {
    if (this.closed) return
    this.closed = true
    if (this.pacer) clearInterval(this.pacer)
    this.pacer = null
    this.capture?.kill('SIGKILL')
    this.capture = null
    this.player?.kill('SIGKILL')
    this.player = null
    this.outQueue = []
    for (const listener of this.closeListeners) listener(reason)
  }
}
