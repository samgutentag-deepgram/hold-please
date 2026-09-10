import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createBus, type DemoEvent } from '../src/bus/events.ts'

test('emit stamps a monotonic timestamp and preserves the payload', () => {
  const bus = createBus()
  const first = bus.emit({ kind: 'stt.update', text: 'hello', eotConfidence: 0.42 })
  const second = bus.emit({ kind: 'stt.endOfTurn', text: 'hello', latencyMs: 260 })

  assert.equal(typeof first.t, 'number')
  assert.ok(Number.isFinite(first.t))
  assert.ok(second.t >= first.t, 'timestamps must never go backwards')
  assert.equal(first.kind, 'stt.update')
  assert.deepEqual(first, { t: first.t, kind: 'stt.update', text: 'hello', eotConfidence: 0.42 })
})

test('listeners receive every event in order and can unsubscribe', () => {
  const bus = createBus()
  const seen: DemoEvent['kind'][] = []
  const off = bus.on((event) => seen.push(event.kind))

  bus.emit({ kind: 'stt.startOfTurn' })
  bus.emit({ kind: 'stt.turnResumed' })
  off()
  bus.emit({ kind: 'call.ended', callId: 'c1' })

  assert.deepEqual(seen, ['stt.startOfTurn', 'stt.turnResumed'])
})

test('the log keeps every event in emit order and reset clears it', () => {
  const bus = createBus()
  bus.emit({ kind: 'call.started', callId: 'c1' })
  bus.emit({ kind: 'config.applied', reconnected: false, fields: ['keyterms'] })

  assert.deepEqual(bus.log.map((e) => e.kind), ['call.started', 'config.applied'])
  bus.reset()
  assert.equal(bus.log.length, 0)
})

test('a throwing listener does not stop delivery to the others', () => {
  const bus = createBus()
  let delivered = 0
  const originalError = console.error
  console.error = () => {}
  try {
    bus.on(() => {
      throw new Error('boom')
    })
    bus.on(() => {
      delivered += 1
    })
    bus.emit({ kind: 'tts.interrupt', textSpoken: 'Thanks for calling' })
  } finally {
    console.error = originalError
  }
  assert.equal(delivered, 1)
})
