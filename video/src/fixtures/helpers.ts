import type { DemoEvent } from '../types.ts'

/**
 * A long caller turn, expanded into the ~4 Update events per second Flux actually sends.
 *
 * Writing twenty-odd update lines by hand is how a fixture drifts from the real report rate,
 * and beat 4's whole argument is the shape of that trace. Give it the confidences and the
 * partial transcripts and it lays them on a fixed cadence.
 */
export function updates(
  startMs: number,
  everyMs: number,
  samples: { c: number; text?: string }[],
): DemoEvent[] {
  let text = ''
  return samples.map((s, i) => {
    if (s.text) text = s.text
    return { t: startMs + i * everyMs, kind: 'stt.update', text, eotConfidence: s.c } as DemoEvent
  })
}

/** Put a call on screen that has already been up for `s` seconds when the scene starts. */
export const callStartedAgo = (s: number, callId = 'live'): DemoEvent => ({
  t: -s * 1000,
  kind: 'call.started',
  callId,
})

export const byTime = (events: DemoEvent[]): DemoEvent[] => [...events].sort((a, b) => a.t - b.t)
