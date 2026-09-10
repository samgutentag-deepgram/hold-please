import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'
import { WebSocketServer, WebSocket } from 'ws'
import type { Bus, DemoEvent } from '../bus/events.ts'

// One port, three jobs: the dashboard page and its event socket, the Vonage webhooks, and the
// Vonage audio socket. Audio never reaches the browser; the dashboard socket carries JSON only.

const PUBLIC_DIR = fileURLToPath(new URL('./public/', import.meta.url))
export const DASHBOARD_WS_PATH = '/ws/dashboard'

const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
}

/** Returns true when it handled the request. */
export type HttpHandler = (req: IncomingMessage, res: ServerResponse) => Promise<boolean>
export type UpgradeHandler = (ws: WebSocket, req: IncomingMessage) => void

export interface WebServerOptions {
  port: number
  host: string
  bus: Bus
  handlers?: HttpHandler[]
  upgrades?: Record<string, UpgradeHandler>
}

export interface WebServer {
  server: Server
  close(): Promise<void>
}

export function startWebServer(opts: WebServerOptions): Promise<WebServer> {
  const { port, host, bus } = opts
  const handlers = opts.handlers ?? []

  const server = createServer((req, res) => {
    handleHttp(req, res, handlers).catch((err: unknown) => {
      console.error('[web] request failed', req.method, req.url, err)
      if (!res.headersSent) sendText(res, 500, 'Something broke serving this page. The call is unaffected.')
      else res.end()
    })
  })

  const dashboard = new WebSocketServer({ noServer: true })
  const upgrades = new Map<string, { wss: WebSocketServer; handler: UpgradeHandler }>()
  for (const [path, handler] of Object.entries(opts.upgrades ?? {})) {
    upgrades.set(path, { wss: new WebSocketServer({ noServer: true }), handler })
  }

  server.on('upgrade', (req, socket, head) => {
    const { pathname } = new URL(req.url ?? '/', 'http://localhost')
    if (pathname === DASHBOARD_WS_PATH) {
      dashboard.handleUpgrade(req, socket, head, (ws) => dashboard.emit('connection', ws, req))
      return
    }
    const target = upgrades.get(pathname)
    if (!target) {
      socket.write('HTTP/1.1 404 Not Found\r\n\r\n')
      socket.destroy()
      return
    }
    target.wss.handleUpgrade(req, socket, head, (ws) => target.handler(ws, req))
  })

  dashboard.on('connection', (ws) => {
    // A late-joining browser gets the whole log so the page is never blank after a refresh.
    ws.send(JSON.stringify({ type: 'replay', events: bus.log }))
    ws.on('error', (err) => console.error('[web] dashboard socket error', err))
  })

  const unsubscribe = bus.on((event: DemoEvent) => {
    const frame = JSON.stringify({ type: 'event', event })
    for (const client of dashboard.clients) {
      if (client.readyState === WebSocket.OPEN) client.send(frame)
    }
  })

  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(port, host, () => {
      server.off('error', reject)
      server.on('error', (err) => console.error('[web] server error', err))
      resolve({
        server,
        close: () =>
          new Promise<void>((done) => {
            unsubscribe()
            for (const client of dashboard.clients) client.terminate()
            dashboard.close()
            for (const { wss } of upgrades.values()) {
              for (const client of wss.clients) client.terminate()
              wss.close()
            }
            server.close(() => done())
          }),
      })
    })
  })
}

async function handleHttp(req: IncomingMessage, res: ServerResponse, handlers: HttpHandler[]): Promise<void> {
  for (const handler of handlers) {
    if (await handler(req, res)) return
  }

  const { pathname } = new URL(req.url ?? '/', 'http://localhost')

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    sendText(res, 405, 'Method not allowed')
    return
  }

  if (pathname === '/healthz') {
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ ok: true }))
    return
  }

  const target = pathname === '/' ? '/index.html' : pathname
  const safe = normalize(target).replace(/^(\.\.[/\\])+/, '')
  const filePath = join(PUBLIC_DIR, safe)
  if (!filePath.startsWith(PUBLIC_DIR)) {
    sendText(res, 404, 'Not found')
    return
  }

  try {
    const body = await readFile(filePath)
    res.writeHead(200, {
      'content-type': CONTENT_TYPES[extname(filePath)] ?? 'application/octet-stream',
      'cache-control': 'no-store',
    })
    res.end(req.method === 'HEAD' ? undefined : body)
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') sendText(res, 404, 'Not found')
    else throw err
  }
}

function sendText(res: ServerResponse, status: number, text: string): void {
  res.writeHead(status, { 'content-type': 'text/plain; charset=utf-8' })
  res.end(text)
}
