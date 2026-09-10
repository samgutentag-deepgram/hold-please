import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createBus } from '../src/bus/events.ts'
import { FluxTts, buildTtsUrl } from '../src/tts/fluxTts.ts'
import { fakeClock, fakeFactory } from './fakeSocket.ts'

test('the URL names the voice and asks for raw 16 kHz linear16', () => {
  const url = new URL(buildTtsUrl('flux-haley-en'))
  assert.equal(url.pathname, '/v2/speak')
  assert.equal(url.searchParams.get('model'), 'flux-haley-en')
  assert.equal(url.searchParams.get('encoding'), 'linear16')
  assert.equal(url.searchParams.get('sample_rate'), '16000')
})

async function connected() {
  const bus = createBus()
  const { factory, sockets } = fakeFactory()
  const c = fakeClock()
  const tts = new FluxTts({ apiKey: 'k', voice: 'flux-haley-en', bus, createSocket: factory, clock: c.now })
  const connecting = tts.connect()
  const sock = sockets[0]!
  sock.open()
  await connecting
  return { bus, tts, sock, c }
}

test('speak streams Speak messages, flush ends the turn, first byte is timed from beginTurn', async () => {
  const { bus, tts, sock, c } = await connected()
  const heard: Buffer[] = []
  tts.onAudio((pcm) => heard.push(pcm))

  tts.beginTurn('turn-1')
  tts.speak('Sure, ')
  tts.speak('I can help.')
  tts.flush()
  assert.deepEqual(sock.sentJson(), [
    { type: 'Speak', text: 'Sure, ' },
    { type: 'Speak', text: 'I can help.' },
    { type: 'Flush' },
  ])
  sock.serverJson({ type: 'SpeechStarted', speech_id: 'dg_sp_1' })
  c.advance(90)
  sock.serverBinary(Buffer.alloc(640))
  sock.serverBinary(Buffer.alloc(640))
  const first = bus.log.find((e) => e.kind === 'tts.firstByte')
  assert.ok(first && first.kind === 'tts.firstByte' && first.turnId === 'turn-1' && first.ttfbMs === 90)
  assert.equal(bus.log.filter((e) => e.kind === 'tts.firstByte').length, 1, 'only the first frame is timed')
  assert.equal(heard.length, 2)
})

test('interrupt carries the playback offset, drops in-flight audio, and surfaces text_spoken', async () => {
  const { bus, tts, sock } = await connected()
  const heard: Buffer[] = []
  tts.onAudio((pcm) => heard.push(pcm))
  tts.beginTurn('turn-2')
  tts.speak('Long answer.')

  tts.interrupt(2340.4)
  assert.deepEqual(sock.sentJson().at(-1), { type: 'Interrupt', playback_offset: { type: 'time_ms', value: 2340 } })
  sock.serverBinary(Buffer.alloc(640)) // already on the wire
  assert.equal(heard.length, 0, 'frames after Interrupt are discarded')
  sock.serverJson({ type: 'SpeechInterrupted', audio_played_ms: 2340, text_spoken: 'Long', text_remaining: ' answer.' })
  const ev = bus.log.find((e) => e.kind === 'tts.interrupt')
  assert.ok(ev && ev.kind === 'tts.interrupt' && ev.textSpoken === 'Long')
  sock.serverBinary(Buffer.alloc(640)) // next turn's audio flows again
  assert.equal(heard.length, 1)
})

test('an ignored interrupt (warning) stops discarding, and an Error degrades', async () => {
  const { bus, tts, sock } = await connected()
  const heard: Buffer[] = []
  tts.onAudio((pcm) => heard.push(pcm))
  tts.interrupt(0)
  sock.serverJson({ type: 'Warning', code: 'NO_AUDIO_GENERATED', description: 'nothing to interrupt' })
  sock.serverBinary(Buffer.alloc(640))
  assert.equal(heard.length, 1)
  sock.serverJson({ type: 'Error', code: 'NET-0003', description: 'time limit' })
  assert.ok(bus.log.some((e) => e.kind === 'socket.degraded' && e.which === 'tts'))
})
