import type { SocketLike } from '../src/net/socket.ts'

// A websocket that records what was sent and lets a test play the server's side.
export class FakeSocket implements SocketLike {
  readyState = 0
  sent: Array<string | Buffer> = []
  closed = false
  pings = 0
  private listeners: Record<string, Array<(...args: unknown[]) => void>> = {}

  readonly url: string
  readonly headers: Record<string, string>

  constructor(url: string, headers: Record<string, string>) {
    this.url = url
    this.headers = headers
  }

  send(data: string | Buffer): void {
    this.sent.push(data)
  }
  close(): void {
    this.closed = true
    this.readyState = 3
    this.fire('close', 1000, Buffer.from('bye'))
  }
  ping(): void {
    this.pings += 1
  }
  on(event: string, listener: (...args: never[]) => void): void {
    ;(this.listeners[event] ??= []).push(listener as (...args: unknown[]) => void)
  }

  // Test controls
  open(): void {
    this.readyState = 1
    this.fire('open')
  }
  serverJson(msg: unknown): void {
    this.fire('message', Buffer.from(JSON.stringify(msg)), false)
  }
  serverBinary(buf: Buffer): void {
    this.fire('message', buf, true)
  }
  serverClose(code = 1006, reason = ''): void {
    this.readyState = 3
    this.fire('close', code, Buffer.from(reason))
  }
  sentJson(): Array<Record<string, unknown>> {
    return this.sent.filter((s): s is string => typeof s === 'string').map((s) => JSON.parse(s) as Record<string, unknown>)
  }
  private fire(event: string, ...args: unknown[]): void {
    for (const listener of this.listeners[event] ?? []) listener(...args)
  }
}

export function fakeFactory(): { factory: (url: string, headers: Record<string, string>) => FakeSocket; sockets: FakeSocket[] } {
  const sockets: FakeSocket[] = []
  return {
    sockets,
    factory: (url, headers) => {
      const s = new FakeSocket(url, headers)
      sockets.push(s)
      return s
    },
  }
}

/** A clock a test can advance by hand. */
export function fakeClock(start = 1000): { now: () => number; advance: (ms: number) => void } {
  let t = start
  return { now: () => t, advance: (ms) => (t += ms) }
}
