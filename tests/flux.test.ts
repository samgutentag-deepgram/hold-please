import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createBus } from '../src/bus/events.ts'
import { FluxStt, buildFluxUrl, validateParams } from '../src/stt/flux.ts'
import { fakeClock, fakeFactory } from './fakeSocket.ts'

const params = { model: 'flux-general-en', eotThreshold: 0.7, eotTimeoutMs: 5000, keyterms: [] as string[] }

test('the URL carries every parameter under its real name, keyterms repeated', () => {
  const url = new URL(buildFluxUrl({ ...params, eagerEotThreshold: 0.5, keyterms: ['A7', 'Harbor Light'] }))
  assert.equal(url.pathname, '/v2/listen')
  assert.equal(url.searchParams.get('model'), 'flux-general-en')
  assert.equal(url.searchParams.get('encoding'), 'linear16')
  assert.equal(url.searchParams.get('sample_rate'), '16000')
  assert.equal(url.searchParams.get('eot_threshold'), '0.7')
  assert.equal(url.searchParams.get('eot_timeout_ms'), '5000')
  assert.equal(url.searchParams.get('eager_eot_threshold'), '0.5')
  assert.deepEqual(url.searchParams.getAll('keyterm'), ['A7', 'Harbor Light'])
  assert.equal(url.searchParams.has('eot_silence_threshold_ms'), false, 'the stale blog parameter must never appear')
})

test('eager above eot is rejected before any socket sees it', () => {
  assert.match(validateParams({ eotThreshold: 0.6, eotTimeoutMs: 5000, eagerEotThreshold: 0.8 }) ?? '', /must be <=/)
  assert.equal(validateParams({ eotThreshold: 0.8, eotTimeoutMs: 5000, eagerEotThreshold: 0.8 }), null)
  assert.throws(() => new FluxStt({ apiKey: 'k', bus: createBus(), params: { ...params, eagerEotThreshold: 0.9 } }), /must be <=/)
})

test('connect sends the Token header and emits turn events with the right shapes', async () => {
  const bus = createBus()
  const { factory, sockets } = fakeFactory()
  const c = fakeClock()
  const stt = new FluxStt({ apiKey: 'secret', bus, params, createSocket: factory, clock: c.now })
  const connecting = stt.connect()
  const sock = sockets[0]!
  assert.equal(sock.headers['Authorization'], 'Token secret')
  sock.open()
  await connecting

  // 1 s of audio in 20 ms frames, 10 ms of wall clock each.
  for (let i = 0; i < 50; i++) {
    stt.sendAudio(Buffer.alloc(640))
    c.advance(10)
  }
  sock.serverJson({ type: 'TurnInfo', event: 'StartOfTurn', turn_index: 0, transcript: 'Hi', words: [], end_of_turn_confidence: 0.1, audio_window_start: 0, audio_window_end: 0.4 })
  sock.serverJson({ type: 'TurnInfo', event: 'Update', turn_index: 0, transcript: 'Hi there', words: [], end_of_turn_confidence: 0.42, audio_window_start: 0, audio_window_end: 0.8 })
  c.advance(300)
  sock.serverJson({
    type: 'TurnInfo', event: 'EndOfTurn', turn_index: 0, transcript: 'Hi there.', trigger: 'model',
    words: [{ word: 'Hi', confidence: 0.9, start: 0.1, end: 0.3 }, { word: 'there.', confidence: 0.9, start: 0.3, end: 0.6 }],
    end_of_turn_confidence: 0.8, audio_window_start: 0, audio_window_end: 1.0, languages: ['en'],
  })

  const kinds = bus.log.map((e) => e.kind)
  assert.deepEqual(kinds, ['stt.startOfTurn', 'stt.update', 'stt.endOfTurn', 'stt.languages'])
  const update = bus.log[1]!
  assert.ok(update.kind === 'stt.update' && update.eotConfidence === 0.42)
  const eot = bus.log[2]!
  assert.ok(eot.kind === 'stt.endOfTurn')
  // Last word ended at 0.6 s of audio. Frame 29 (0-based) ends at 0.6 s and was sent at t = 1290; now is 1800.
  assert.equal(eot.latencyMs, 510)
})

test('configure on the open socket sends Configure and proves no reconnect', async () => {
  const bus = createBus()
  const { factory, sockets } = fakeFactory()
  const stt = new FluxStt({ apiKey: 'k', bus, params, createSocket: factory })
  const connecting = stt.connect()
  const sock = sockets[0]!
  sock.open()
  await connecting

  const pending = stt.configure({ keyterms: ['A7', '4K'], eotThreshold: 0.8 })
  const msg = sock.sentJson().at(-1)!
  assert.deepEqual(msg, { type: 'Configure', keyterms: ['A7', '4K'], thresholds: { eot_threshold: 0.8 } })
  sock.serverJson({ type: 'ConfigureSuccess' })
  const result = await pending
  assert.equal(result.ok, true)
  assert.deepEqual(stt.params.keyterms, ['A7', '4K'])
  assert.equal(stt.params.eotThreshold, 0.8)
  const applied = bus.log.at(-1)!
  assert.ok(applied.kind === 'config.applied' && applied.reconnected === false)
  assert.deepEqual(applied.kind === 'config.applied' ? applied.fields : [], ['keyterms', 'eot_threshold'])
  assert.equal(sockets.length, 1, 'still the same socket')
})

test('a rejected configure leaves the params alone and reports why', async () => {
  const bus = createBus()
  const { factory, sockets } = fakeFactory()
  const stt = new FluxStt({ apiKey: 'k', bus, params, createSocket: factory })
  const connecting = stt.connect()
  sockets[0]!.open()
  await connecting
  const local = await stt.configure({ eagerEotThreshold: 0.9 })
  assert.equal(local.ok, false)
  assert.match(local.detail ?? '', /must be <=/)
  const pending = stt.configure({ eotTimeoutMs: 900 })
  sockets[0]!.serverJson({ type: 'ConfigureFailure', description: 'nope' })
  const remote = await pending
  assert.equal(remote.ok, false)
  assert.equal(stt.params.eotTimeoutMs, 5000)
  assert.equal(bus.log.some((e) => e.kind === 'config.applied'), false)
})

test('an unexpected close degrades visibly and reconnects with the current params', async () => {
  const bus = createBus()
  const { factory, sockets } = fakeFactory()
  const stt = new FluxStt({ apiKey: 'k', bus, params, createSocket: factory })
  const connecting = stt.connect()
  sockets[0]!.open()
  await connecting
  const pending = stt.configure({ keyterms: ['Q'] })
  sockets[0]!.serverJson({ type: 'ConfigureSuccess' })
  await pending

  sockets[0]!.serverClose(1006, 'network')
  assert.ok(bus.log.some((e) => e.kind === 'socket.degraded' && e.which === 'stt'))
  await new Promise((r) => setTimeout(r, 600))
  assert.equal(sockets.length, 2, 'a second socket was opened')
  assert.deepEqual(new URL(sockets[1]!.url).searchParams.getAll('keyterm'), ['Q'])
  sockets[1]!.open()
  assert.ok(bus.log.some((e) => e.kind === 'socket.recovered' && e.which === 'stt'))
  await stt.close()
})
