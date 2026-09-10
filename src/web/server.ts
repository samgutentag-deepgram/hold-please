import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'
import { WebSocketServer, WebSocket } from 'ws'
import type { Bus, DemoEvent } from '../bus/events.ts'

// One port, three jobs: the dashboard page, the dashboard's event socket, and later the Vonage
// webhooks and audio socket. Audio never reaches the browser; this socket carries JSON events only.

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

export interface WebServer {
  server: Server
  wss: WebSocketServer
  close(): Promise<void>
}

export function startWebServer(opts: { port: number; host: string; bus: Bus }): Promise<WebServer> {
  const { port, host, bus } = opts

  const server = createServer((req, res) => {
    handleHttp(req, res).catch((err: unknown) => {
      console.error('[web] request failed', req.method, req.url, err)
      if (!res.headersSent) sendText(res, 500, 'Something broke serving this page. The call is unaffected.')
      else res.end()
    })
  })

  const wss = new WebSocketServer({ noServer: true })

  server.on('upgrade', (req, socket, head) => {
    const { pathname } = new URL(req.url ?? '/', 'http://localhost')
    if (pathname !== DASHBOARD_WS_PATH) {
      socket.write('HTTP/1.1 404 Not Found\r\n\r\n')
      socket.destroy()
      return
    }
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req))
  })

  wss.on('connection', (ws) => {
    // A late-joining browser gets the whole log so the page is never blank after a refresh.
    ws.send(JSON.stringify({ type: 'replay', events: bus.log }))
    ws.on('error', (err) => console.error('[web] dashboard socket error', err))
  })

  const unsubscribe = bus.on((event: DemoEvent) => {
    const frame = JSON.stringify({ type: 'event', event })
    for (const client of wss.clients) {
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
        wss,
        close: () =>
          new Promise<void>((done) => {
            unsubscribe()
            for (const client of wss.clients) client.terminate()
            wss.close()
            server.close(() => done())
          }),
      })
    })
  })
}

async function handleHttp(req: IncomingMessage, res: ServerResponse): Promise<void> {
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
