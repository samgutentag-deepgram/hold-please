// An audio leg is wherever the caller's voice comes from and the agent's voice goes to.
// On stage it is the Vonage websocket. In development it is the microphone and speakers.
// Everything downstream of the leg is identical, which is the whole point of the abstraction.

export const SAMPLE_RATE = 16_000
export const BYTES_PER_SAMPLE = 2
export const FRAME_MS = 20
export const FRAME_BYTES = (SAMPLE_RATE * BYTES_PER_SAMPLE * FRAME_MS) / 1000 // 640

export interface AudioLeg {
  readonly name: 'vonage' | 'local'
  /** Caller audio, 16 kHz mono signed 16-bit little-endian PCM, in 20 ms frames. */
  onAudio(listener: (pcm: Buffer) => void): void
  /** Agent audio to the caller, same format. May arrive faster than real time. */
  send(pcm: Buffer): void
  /** Drop any agent audio the far side has buffered but not yet played. Barge-in. */
  clear(): void
  onClose(listener: (reason: string) => void): void
  close(): Promise<void>
}

/** Re-cut a stream of PCM into fixed-size frames, carrying a remainder between calls. */
export class Framer {
  private rest: Buffer = Buffer.alloc(0)
  private readonly frameBytes: number
  constructor(frameBytes: number = FRAME_BYTES) {
    this.frameBytes = frameBytes
  }

  push(chunk: Buffer): Buffer[] {
    const data = this.rest.length ? Buffer.concat([this.rest, chunk]) : chunk
    const frames: Buffer[] = []
    let offset = 0
    while (data.length - offset >= this.frameBytes) {
      frames.push(data.subarray(offset, offset + this.frameBytes))
      offset += this.frameBytes
    }
    this.rest = data.subarray(offset)
    return frames
  }

  reset(): void {
    this.rest = Buffer.alloc(0)
  }
}
