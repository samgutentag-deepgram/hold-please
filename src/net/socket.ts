import { WebSocket } from 'ws'

// The slice of a websocket the Deepgram clients use, so tests can hand them a fake.
export interface SocketLike {
  readonly readyState: number
  send(data: string | Buffer): void
  close(code?: number, reason?: string): void
  ping?(): void
  on(event: 'open', listener: () => void): void
  on(event: 'message', listener: (data: Buffer | string, isBinary: boolean) => void): void
  on(event: 'close', listener: (code: number, reason: Buffer | string) => void): void
  on(event: 'error', listener: (err: Error) => void): void
}

export const OPEN = 1

export type SocketFactory = (url: string, headers: Record<string, string>) => SocketLike

export const openWebSocket: SocketFactory = (url, headers) => new WebSocket(url, { headers }) as unknown as SocketLike

/** Reconnect delays in ms. Bounded, because on stage a socket that is down for 8 s is a video cut. */
export const BACKOFF_MS = [500, 1000, 2000, 4000, 8000] as const
