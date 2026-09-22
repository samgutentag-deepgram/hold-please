import { DEFAULT_TOGGLES, type AgentState, type DemoEvent, type Toggles } from './types.ts'

// A pure port of the dashboard's apply() from src/web/public/index.html.
//
// The live page is a mutable DOM reducer driven by a socket. A video frame needs the opposite:
// give it a time in milliseconds and it must hand back the exact state the page would be in.
// So this folds the whole event log from zero on every frame. 226 events at 30fps is nothing,
// and a pure function means scrubbing in the studio lands on the same pixels as a render.

export interface TracePoint {
  dt: number
  c: number
}

export interface FrozenTrace {
  /** Points including the synthetic (0,0) the dashboard prepends so the shape reads as a climb. */
  pts: TracePoint[]
  ticks: TracePoint[]
  spanMs: number
  latencyMs: number
  lastC: number
  samples: number
  threshold: number
  frozenAtMs: number
}

export interface DashState {
  tMs: number
  conn: 'connecting' | 'live' | 'disconnected'
  languages: string[]
  langChangedAtMs: number | null
  agentState: AgentState
  stateLabel: string
  toggles: Toggles
  caller: { text: string; interim: boolean; empty: boolean }
  agent: { text: string; cut: boolean; empty: boolean }
  conf: number
  liveTrace: TracePoint[]
  turnLive: boolean
  frozen: FrozenTrace | null
  eotMs: number | null
  eotPercentiles: [number, number, number] | null
  ttftMs: number | null
  ttfbMs: number | null
  specIssued: number
  specUsed: number
  uptimeS: number | null
  reconnects: number
  degraded: string | null
  applied: { text: string; ok: boolean } | null
  /** Every event at or before tMs, newest last. Feeds the event-log pane. */
  seen: DemoEvent[]
}

const pct = (arr: number[], p: number) => {
  const s = [...arr].sort((a, b) => a - b)
  return s[Math.min(s.length - 1, Math.floor(p * s.length))]
}

/** The dashboard clears the applied banner after 6s. */
const APPLIED_MS = 6000

export function replay(events: DemoEvent[], tMs: number, initialToggles?: Partial<Toggles>): DashState {
  const s: DashState = {
    tMs,
    conn: 'live',
    languages: [],
    langChangedAtMs: null,
    agentState: 'idle',
    stateLabel: 'waiting',
    toggles: { ...DEFAULT_TOGGLES, ...initialToggles },
    caller: { text: 'Waiting for a call', interim: false, empty: true },
    agent: { text: '', cut: false, empty: true },
    conf: 0,
    liveTrace: [],
    turnLive: false,
    frozen: null,
    eotMs: null,
    eotPercentiles: null,
    ttftMs: null,
    ttfbMs: null,
    specIssued: 0,
    specUsed: 0,
    uptimeS: null,
    reconnects: 0,
    degraded: null,
    applied: null,
    seen: [],
  }

  let callStartedAt: number | null = null
  let turnStartT: number | null = null
  let trace: TracePoint[] = []
  let appliedAt: number | null = null
  const specTurns = new Set<string>()
  const eotSamples: number[] = []

  for (const e of events) {
    if (e.t > tMs) break
    s.seen.push(e)

    switch (e.kind) {
      case 'call.started':
        s.languages = []
        callStartedAt = e.t
        turnStartT = null
        trace = []
        s.frozen = null
        s.caller = { text: 'Listening…', interim: false, empty: true }
        s.agent = { text: '', cut: false, empty: true }
        break

      case 'call.ended':
        callStartedAt = null
        s.agentState = 'idle'
        s.stateLabel = 'call ended'
        break

      case 'agent.state':
        s.agentState = e.state
        s.stateLabel = e.state
        break

      case 'stt.startOfTurn':
        turnStartT = e.t
        trace = []
        s.caller = { ...s.caller, empty: false }
        break

      case 'stt.update':
        s.conf = e.eotConfidence
        if (turnStartT !== null) trace.push({ dt: e.t - turnStartT, c: e.eotConfidence })
        if (e.text) s.caller = { text: e.text, interim: true, empty: false }
        break

      case 'stt.endOfTurn': {
        s.caller = { text: e.text, interim: false, empty: false }
        s.frozen = freeze(trace, e.latencyMs, s.toggles.eotThreshold, e.t)
        turnStartT = null
        s.eotMs = e.latencyMs
        eotSamples.push(e.latencyMs)
        s.eotPercentiles = [pct(eotSamples, 0.5), pct(eotSamples, 0.9), pct(eotSamples, 0.95)]
        break
      }

      case 'stt.languages':
        s.languages = e.languages
        s.langChangedAtMs = e.t
        break

      case 'agent.reply':
        s.agent = { text: e.text, cut: false, empty: false }
        break

      case 'tts.interrupt':
        s.agent = {
          text: e.textSpoken || '(cut before a word was heard)',
          cut: true,
          empty: false,
        }
        break

      case 'tts.firstByte':
        s.ttfbMs = e.ttfbMs
        break

      case 'llm.speculativeStart':
        specTurns.add(e.turnId)
        s.specIssued = specTurns.size
        break

      case 'llm.firstToken':
        if (specTurns.has(e.turnId)) s.specUsed += 1
        s.ttftMs = e.ttftMs
        break

      case 'socket.degraded':
        s.degraded = `${e.which} degraded: ${e.detail}`.slice(0, 120)
        break

      case 'socket.recovered':
        if (e.attempts) s.reconnects += 1
        s.degraded = null
        break

      case 'config.applied':
        s.degraded = null
        s.applied = {
          text: (e.reconnected ? 'RECONNECTED: ' : 'applied live, no reconnect: ') + e.fields.join(', '),
          ok: !e.reconnected,
        }
        appliedAt = e.t
        break

      case 'toggle.changed':
        s.toggles = { ...s.toggles, [e.name]: e.value as never }
        break
    }
  }

  if (appliedAt !== null && tMs - appliedAt > APPLIED_MS) s.applied = null
  s.turnLive = turnStartT !== null
  s.liveTrace = trace
  s.uptimeS = callStartedAt === null ? null : Math.max(0, Math.floor((tMs - callStartedAt) / 1000))
  return s
}

function freeze(trace: TracePoint[], latencyMs: number, threshold: number, atMs: number): FrozenTrace {
  const ticks = trace
  // Start at zero confidence so a one-sample turn still draws a line rather than a floating dot.
  const pts = trace.length ? [{ dt: 0, c: 0 }, ...trace] : []
  const spanMs = Math.max(1, pts.length ? pts[pts.length - 1].dt : 1)
  return {
    pts,
    ticks,
    spanMs,
    latencyMs,
    lastC: trace.length ? trace[trace.length - 1].c : 0,
    samples: trace.length,
    threshold,
    frozenAtMs: atMs,
  }
}

export const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
