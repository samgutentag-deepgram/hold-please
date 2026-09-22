import type { DemoEvent } from '../types.ts'

// The migration path off fixtures.
//
// `npm run dev` in the demo writes recordings/<stamp>-local-events.jsonl alongside the caller
// wav. Once a beat has been captured on a real call, import that file with Remotion's
// `staticFile` + fetch (or paste it into a .ts), run it through here, and hand the result to a
// BeatSpec's `events`. Nothing else in the video has to change: the replay reducer is the same
// one the live dashboard uses, so a recording renders exactly as it played.

const KNOWN: ReadonlySet<string> = new Set([
  'process.started', 'call.started', 'call.ended', 'agent.state', 'agent.reply',
  'stt.startOfTurn', 'stt.update', 'stt.eagerEndOfTurn', 'stt.turnResumed', 'stt.endOfTurn',
  'stt.languages', 'llm.speculativeStart', 'llm.speculativeCancel', 'llm.firstToken',
  'tts.firstByte', 'tts.interrupt', 'socket.degraded', 'socket.recovered', 'toggle.changed',
  'config.applied',
])

export interface FromJsonlOptions {
  /**
   * Where t=0 should land, in the recording's own clock. Defaults to the first event, which
   * is usually a `call.started` and would make the uptime counter read 0:00 on frame one.
   * Pass the ms of the moment the beat actually begins to keep the call looking warm.
   */
  zeroAtMs?: number
  /** Drop anything before zeroAtMs except call.started, which the dashboard needs for uptime. */
  trim?: boolean
}

export function fromJsonl(text: string, opts: FromJsonlOptions = {}): DemoEvent[] {
  const parsed: DemoEvent[] = []
  const unknown = new Set<string>()

  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue
    let e: unknown
    try {
      e = JSON.parse(trimmed)
    } catch {
      // The recorder writes one object per line. A truncated last line is normal if the
      // process was killed mid-write, so skip it rather than failing the render.
      continue
    }
    if (typeof e !== 'object' || e === null) continue
    const rec = e as { t?: unknown; kind?: unknown }
    if (typeof rec.t !== 'number' || typeof rec.kind !== 'string') continue
    // The recorder also emits `debug` lines the dashboard ignores. So do we.
    if (!KNOWN.has(rec.kind)) {
      if (rec.kind !== 'debug') unknown.add(rec.kind)
      continue
    }
    parsed.push(e as DemoEvent)
  }

  if (unknown.size) {
    // Loud, but not fatal: a new event kind means src/bus/events.ts moved and types.ts has not.
    console.warn(`[fromJsonl] unknown event kinds, update src/types.ts: ${[...unknown].join(', ')}`)
  }

  parsed.sort((a, b) => a.t - b.t)
  const zero = opts.zeroAtMs ?? (parsed.length ? parsed[0].t : 0)
  const shifted = parsed.map((e) => ({ ...e, t: e.t - zero }))
  if (!opts.trim) return shifted
  return shifted.filter((e) => e.t >= 0 || e.kind === 'call.started')
}
