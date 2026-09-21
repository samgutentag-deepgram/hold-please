import { test } from 'node:test'
import assert from 'node:assert/strict'
import { PlaybackClock } from '../src/audio/playback.ts'
import { BYTES_PER_SAMPLE, FRAME_BYTES, FRAME_MS, Framer, SAMPLE_RATE } from '../src/audio/leg.ts'
import { fakeClock } from './fakeSocket.ts'

// Bytes of 100 ms of mono 16-bit PCM at whatever rate the build is on: 1600 at 8 kHz,
// 3200 at 16 kHz. Derived, because hardcoding it is what broke when the default moved to 8 kHz.
const MS_100 = (SAMPLE_RATE * BYTES_PER_SAMPLE) / 10

test('played time follows the wall clock, capped at what was sent', () => {
  const c = fakeClock()
  const pb = new PlaybackClock(c.now)
  pb.push(MS_100 * 5) // 500 ms queued at once
  c.advance(200)
  assert.equal(pb.playedMs(), 200)
  assert.equal(pb.remainingMs(), 300)
  c.advance(1000)
  assert.equal(pb.playedMs(), 500, 'cannot have heard more than was sent')
  assert.equal(pb.isPlaying(), false)
})

test('audio pushed after the buffer drains starts a new real-time run', () => {
  const c = fakeClock()
  const pb = new PlaybackClock(c.now)
  pb.push(MS_100) // 100 ms
  c.advance(1000) // long silence
  pb.push(MS_100 * 2) // 200 ms more
  c.advance(50)
  assert.equal(pb.playedMs(), 150)
})

test('clear keeps what was heard and drops the rest, and the counter never goes backwards', () => {
  const c = fakeClock()
  const pb = new PlaybackClock(c.now)
  pb.push(MS_100 * 10) // 1 s queued
  c.advance(340)
  pb.clear()
  assert.equal(pb.playedMs(), 340)
  assert.equal(pb.isPlaying(), false)
  c.advance(5000)
  assert.equal(pb.playedMs(), 340)
  pb.push(MS_100)
  c.advance(100)
  assert.equal(pb.playedMs(), 440)
})

test('framer re-cuts arbitrary chunks into 640 byte frames and carries the remainder', () => {
  const f = new Framer(640)
  assert.equal(f.push(Buffer.alloc(100)).length, 0)
  const frames = f.push(Buffer.alloc(1300))
  assert.equal(frames.length, 2)
  assert.ok(frames.every((b) => b.length === 640))
  assert.equal(f.push(Buffer.alloc(520)).length, 1, '120 carried + 520 = one frame')
})

test('the default sample rate is 8 kHz, because the stage is a phone line', () => {
  // PSTN is natively 8 kHz. Every beat-2 keyterm result measured at 16 kHz on a studio mic is a
  // finding about a studio mic. Overriding to 16000 is allowed; anything else is a typo.
  assert.equal(SAMPLE_RATE, 8_000)
  assert.equal(FRAME_BYTES, 320)
  assert.equal((SAMPLE_RATE * BYTES_PER_SAMPLE * FRAME_MS) / 1000, FRAME_BYTES)
})
