import { createWriteStream, mkdirSync, openSync, writeSync, closeSync, type WriteStream } from 'node:fs'
import { join } from 'node:path'
import { now } from '../bus/clock.ts'
import type { Bus } from '../bus/events.ts'
import { SAMPLE_RATE } from '../audio/leg.ts'

// Per-call recording for diagnosis: the caller's audio exactly as Flux received it, as a 16 kHz
// mono WAV, and every bus event plus debug lines as JSON lines with the same clock. With these two
// files a session can be replayed through scripts/keyterm-probe.mjs without the presenter.
// recordings/ is gitignored.

let current: Recorder | null = null

export function debugLog(msg: string, data?: Record<string, unknown>): void {
  const line = { t: now(), kind: 'debug', msg, ...(data ?? {}) }
  console.error('[debug]', msg, data ? JSON.stringify(data) : '')
  current?.line(line)
}

export class Recorder {
  readonly dir: string
  readonly wavPath: string
  readonly logPath: string
  private wavFd: number
  private wavBytes = 0
  private log: WriteStream
  private unsubscribe: () => void

  constructor(bus: Bus, callId: string, root = 'recordings') {
    mkdirSync(root, { recursive: true })
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    this.dir = root
    this.wavPath = join(root, `${stamp}-${callId}-caller.wav`)
    this.logPath = join(root, `${stamp}-${callId}-events.jsonl`)
    this.wavFd = openSync(this.wavPath, 'w')
    writeSync(this.wavFd, wavHeader(0))
    this.log = createWriteStream(this.logPath)
    this.unsubscribe = bus.on((event) => this.line(event))
    current = this
    console.error(`[recorder] ${this.wavPath}\n[recorder] ${this.logPath}`)
  }

  audio(pcm: Buffer): void {
    writeSync(this.wavFd, pcm)
    this.wavBytes += pcm.length
  }

  line(obj: unknown): void {
    this.log.write(JSON.stringify(obj) + '\n')
  }

  close(): void {
    this.unsubscribe()
    if (current === this) current = null
    // Rewrite the header with the real length so any player can open it.
    writeSync(this.wavFd, wavHeader(this.wavBytes), 0, 44, 0)
    closeSync(this.wavFd)
    this.log.end()
  }
}

function wavHeader(dataBytes: number): Buffer {
  const b = Buffer.alloc(44)
  b.write('RIFF', 0)
  b.writeUInt32LE(36 + dataBytes, 4)
  b.write('WAVE', 8)
  b.write('fmt ', 12)
  b.writeUInt32LE(16, 16)
  b.writeUInt16LE(1, 20) // PCM
  b.writeUInt16LE(1, 22) // mono
  b.writeUInt32LE(SAMPLE_RATE, 24)
  b.writeUInt32LE(SAMPLE_RATE * 2, 28)
  b.writeUInt16LE(2, 32)
  b.writeUInt16LE(16, 34)
  b.write('data', 36)
  b.writeUInt32LE(dataBytes, 40)
  return b
}
