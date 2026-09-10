import { loadConfig } from './config.ts'
import { bus } from './bus/events.ts'
import { startWebServer } from './web/server.ts'

// Degrade, never crash. An unhandled error on a projector is worse than a degraded state, so
// both handlers log loudly and keep the process alive. Later phases route these to
// `socket.degraded` events where a socket is the cause.
process.on('unhandledRejection', (reason) => {
  console.error('[process] unhandled rejection', reason)
})
process.on('uncaughtException', (err) => {
  console.error('[process] uncaught exception', err)
})

// The console is the second consumer of the bus, after the dashboard. One JSON line per event,
// so a terminal log can be diffed against what the browser showed.
bus.on((event) => {
  console.log(JSON.stringify(event))
})

async function main(): Promise<void> {
  const config = loadConfig()
  const web = await startWebServer({ port: config.port, host: config.host, bus })

  bus.emit({ kind: 'process.started', port: config.port, host: config.host })
  console.error(`[web] dashboard at http://${config.host}:${config.port}`)

  const shutdown = (signal: NodeJS.Signals) => {
    console.error(`[process] ${signal}, shutting down`)
    web.close().then(() => process.exit(0))
    setTimeout(() => process.exit(1), 2000).unref()
  }
  process.once('SIGINT', shutdown)
  process.once('SIGTERM', shutdown)
}

main().catch((err: unknown) => {
  console.error('[process] failed to start', err)
  process.exit(1)
})
