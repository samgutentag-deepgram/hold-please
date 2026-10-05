import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createBus } from '../src/bus/events.ts'
import { AgentLoop, type LoopDeps } from '../src/agent/loop.ts'
import { DEFAULT_TOGGLES, NAIVE_SILENCE_MS } from '../src/toggles/state.ts'
import type { TurnInfo } from '../src/stt/flux.ts'

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

function rig() {
  let onTurn: (info: TurnInfo) => void = () => {}
  const asked: string[] = []
  const deps = {
    bus: createBus(),
    leg: { send() {}, clear() {} },
    stt: { onTurn(fn: (info: TurnInfo) => void) { onTurn = fn } },
    tts: { onMessage() {}, onAudio() {}, beginTurn() {}, speak() {}, flush() {}, interrupt() {} },
    llm: {
      async *stream(messages: { content: unknown }[]) {
        asked.push(String(messages.at(-1)?.content))
        yield 'ok'
      },
    },
    playback: { push() {}, clear() {}, playedMs: () => 0, remainingMs: () => 0 },
    toggles: () => ({ ...DEFAULT_TOGGLES, smartEot: false }),
  } as unknown as LoopDeps
  new AgentLoop(deps)
  const turn = (event: TurnInfo['event'], transcript: string, turn_index = 0) =>
    onTurn({ type: 'TurnInfo', event, transcript, turn_index, words: [], end_of_turn_confidence: 0, audio_window_start: 0, audio_window_end: 0 })
  return { turn, asked }
}

test('the silence timer fires on a mid-turn pause even while Flux keeps sending Updates', async () => {
  const { turn, asked } = rig()
  turn('StartOfTurn', '')
  // A pause: Flux keeps sending the same transcript every 240 ms.
  for (let ms = 0; ms < NAIVE_SILENCE_MS + 300; ms += 240) {
    turn('Update', 'OK so I work from home')
    await sleep(240)
  }
  assert.deepEqual(asked, ['OK so I work from home'])
  // The caller keeps going; only the new words are answered next time.
  turn('Update', 'OK so I work from home but Tuesdays I am in the office')
  await sleep(NAIVE_SILENCE_MS + 200)
  assert.deepEqual(asked, ['OK so I work from home', 'but Tuesdays I am in the office'])
})

test('first words that arrive before StartOfTurn are not answered on their own', async () => {
  const { turn, asked } = rig()
  turn('Update', 'Can', 1)
  turn('StartOfTurn', 'Can', 1)
  await sleep(240)
  turn('Update', 'Can he start on Trifexis at the visit?', 1)
  await sleep(NAIVE_SILENCE_MS + 200)
  assert.deepEqual(asked, ['Can he start on Trifexis at the visit?'])
})
