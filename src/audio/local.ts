import { spawn, type ChildProcessByStdio } from 'node:child_process'
import type { Readable, Writable } from 'node:stream'
import { FRAME_BYTES, Framer, SAMPLE_RATE, type AudioLeg } from './leg.ts'

// The local harness: microphone in, speakers out, via ffmpeg, so Phases 1 to 5 can be developed
// without a phone. The one thing it cannot prove is the telephony leg itself.
//
// Playback is a fresh ffmpeg process per utterance so that clear() can kill it outright, which
// is the only way to drop buffered audio on a pipe. Startup costs about 100 ms, which is fine
// for a dev loop and irrelevant on stage, where Vonage is the leg.

type Capture = ChildProcessByStdio<null, Readable, Readable>
type Player = ChildProcessByStdio<Writable, null, Readable>

export interface LocalLegOptions {
  micDevice: string
  muteWhileSpeaking: boolean
  isPlaying: () => boolean
}

export class LocalAudioLeg implements AudioLeg {
  readonly name = 'local' as const
  private capture: Capture | null = null
  private player: Player | null = null
  private readonly framer = new Framer(FRAME_BYTES)
  private audioListeners: Array<(pcm: Buffer) => void> = []
  private closeListeners: Array<(reason: string) => void> = []
  private closed = false

  private readonly opts: LocalLegOptions

  constructor(opts: LocalLegOptions) {
    this.opts = opts
  }

  start(): void {
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
      for (const frame of this.framer.push(chunk)) {
        for (const listener of this.audioListeners) listener(frame)
      }
    })
    capture.stderr.on('data', (chunk: Buffer) => console.error('[local mic]', chunk.toString().trim()))
    capture.on('exit', (code) => {
      if (!this.closed) this.finish(`microphone capture exited with code ${code}`)
    })
    capture.on('error', (err) => this.finish(`ffmpeg failed to start: ${err.message}`))
  }

  onAudio(listener: (pcm: Buffer) => void): void {
    this.audioListeners.push(listener)
  }

  send(pcm: Buffer): void {
    if (this.closed) return
    if (!this.player) this.player = this.spawnPlayer()
    this.player.stdin.write(pcm)
  }

  clear(): void {
    if (this.player) {
      this.player.kill('SIGKILL')
      this.player = null
    }
  }

  onClose(listener: (reason: string) => void): void {
    this.closeListeners.push(listener)
  }

  async close(): Promise<void> {
    this.finish('closed')
  }

  private spawnPlayer(): Player {
    const player = spawn(
      'ffmpeg',
      [
        '-hide_banner', '-loglevel', 'error',
        '-f', 's16le', '-ar', String(SAMPLE_RATE), '-ac', '1', '-i', 'pipe:0',
        '-f', 'audiotoolbox', '-',
      ],
      { stdio: ['pipe', 'ignore', 'pipe'] },
    )
    player.stderr.on('data', (chunk: Buffer) => console.error('[local speaker]', chunk.toString().trim()))
    player.stdin.on('error', () => {
      // EPIPE after a kill is expected; nothing to do.
    })
    player.on('exit', () => {
      if (this.player === player) this.player = null
    })
    return player
  }

  private finish(reason: string): void {
    if (this.closed) return
    this.closed = true
    this.capture?.kill('SIGKILL')
    this.capture = null
    this.clear()
    for (const listener of this.closeListeners) listener(reason)
  }
}
