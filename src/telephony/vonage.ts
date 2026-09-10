import type { IncomingMessage, ServerResponse } from 'node:http'
import type { WebSocket } from 'ws'
import type { Bus } from '../bus/events.ts'
import { FRAME_BYTES, Framer, SAMPLE_RATE, type AudioLeg } from '../audio/leg.ts'

// The telephony leg. Vonage calls /webhooks/answer when the number rings, we hand back an NCCO
// that connects the call's audio to our websocket, and from then on the call is 20 ms PCM frames
// in both directions on that socket. Inbound calls need no Vonage credentials at all: the JWT
// is only for REST calls we do not make in this demo.
//
// Reference: https://developer.vonage.com/en/voice/voice-api/concepts/websockets

export const VONAGE_WS_PATH = '/ws/vonage'
export const CONTENT_TYPE = `audio/l16;rate=${SAMPLE_RATE}`

export interface AnswerParams {
  publicUrl: string
  callUuid: string
  from: string | undefined
  to: string | undefined
}

/** The NCCO for an inbound call: connect the audio straight to our websocket. */
export function buildAnswerNcco(params: AnswerParams): unknown[] {
  const wsUrl = params.publicUrl.replace(/^http/, 'ws') + VONAGE_WS_PATH
  return [
    {
      action: 'connect',
      eventUrl: [`${params.publicUrl}/webhooks/event`],
      ...(params.to ? { from: params.to } : {}),
      endpoint: [
        {
          type: 'websocket',
          uri: wsUrl,
          'content-type': CONTENT_TYPE,
          headers: { callId: params.callUuid, caller: params.from ?? 'unknown' },
        },
      ],
    },
  ]
}

interface WebhookBody {
  uuid?: string
  from?: string
  to?: string
  status?: string
  [key: string]: unknown
}

async function readBody(req: IncomingMessage): Promise<WebhookBody> {
  const url = new URL(req.url ?? '/', 'http://localhost')
  if (req.method === 'GET') return Object.fromEntries(url.searchParams)
  const chunks: Buffer[] = []
  for await (const chunk of req) chunks.push(chunk as Buffer)
  const raw = Buffer.concat(chunks).toString('utf8')
  if (!raw) return {}
  try {
    return JSON.parse(raw) as WebhookBody
  } catch {
    return Object.fromEntries(new URLSearchParams(raw))
  }
}

export function createVonageWebhooks(opts: { publicUrl: () => string | undefined; bus: Bus }) {
  return async function handle(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
    const { pathname } = new URL(req.url ?? '/', 'http://localhost')
    if (pathname === '/webhooks/answer') {
      const body = await readBody(req)
      const publicUrl = opts.publicUrl()
      if (!publicUrl) {
        console.error('[vonage] answer webhook hit but PUBLIC_URL is unset; the call will drop')
        res.writeHead(500, { 'content-type': 'application/json' })
        res.end(JSON.stringify([{ action: 'talk', text: 'The demo is not configured yet.' }]))
        return true
      }
      const ncco = buildAnswerNcco({ publicUrl, callUuid: body.uuid ?? 'unknown', from: body.from, to: body.to })
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify(ncco))
      return true
    }
    if (pathname === '/webhooks/event') {
      const body = await readBody(req)
      console.error('[vonage] event', body.status ?? '(no status)', body.uuid ?? '')
      res.writeHead(204)
      res.end()
      return true
    }
    return false
  }
}

/** One Vonage websocket connection is one call's audio. */
export class VonageAudioLeg implements AudioLeg {
  readonly name = 'vonage' as const
  private readonly framer = new Framer(FRAME_BYTES)
  private audioListeners: Array<(pcm: Buffer) => void> = []
  private closeListeners: Array<(reason: string) => void> = []
  private closed = false
  callId = 'unknown'
  private readonly ws: WebSocket

  constructor(ws: WebSocket) {
    this.ws = ws
    ws.on('message', (data: Buffer | string, isBinary: boolean) => {
      if (isBinary) {
        for (const listener of this.audioListeners) listener(data as Buffer)
        return
      }
      try {
        const msg = JSON.parse(data.toString()) as { event?: string; callId?: string; [k: string]: unknown }
        if (msg.event === 'websocket:connected') {
          if (typeof msg['callId'] === 'string') this.callId = msg['callId']
          console.error('[vonage] websocket connected', msg['content-type'] ?? '', this.callId)
        } else if (msg.event !== 'websocket:cleared') {
          console.error('[vonage] ws message', msg)
        }
      } catch {
        console.error('[vonage] non-JSON text frame ignored')
      }
    })
    ws.on('close', (code) => this.finish(`vonage socket closed (${code})`))
    ws.on('error', (err) => this.finish(`vonage socket error: ${err.message}`))
  }

  onAudio(listener: (pcm: Buffer) => void): void {
    this.audioListeners.push(listener)
  }

  send(pcm: Buffer): void {
    if (this.closed || this.ws.readyState !== this.ws.OPEN) return
    // Vonage wants the audio in the same 20 ms frames it sends us.
    for (const frame of this.framer.push(pcm)) this.ws.send(frame, { binary: true })
  }

  clear(): void {
    this.framer.reset()
    if (this.ws.readyState === this.ws.OPEN) this.ws.send(JSON.stringify({ action: 'clear' }))
  }

  onClose(listener: (reason: string) => void): void {
    this.closeListeners.push(listener)
  }

  async close(): Promise<void> {
    if (this.ws.readyState === this.ws.OPEN) this.ws.close(1000, 'call ended')
    this.finish('closed by us')
  }

  private finish(reason: string): void {
    if (this.closed) return
    this.closed = true
    for (const listener of this.closeListeners) listener(reason)
  }
}
