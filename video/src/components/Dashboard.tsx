import React from 'react'
import { dashboardCss } from '../dashboardCss.ts'
import { mmss, type DashState, type TracePoint } from '../replay.ts'
import type { ToggleName } from '../types.ts'

// A faithful re-render of src/web/public/index.html from a DashState. Same markup, same
// classes, same ids, same stylesheet. The only thing missing is the websocket, because here
// the events arrive from a fixture or a recording instead of a live call.

// hold-please 09d38e0. All five default off, all five mean "on = the fix", so nothing here
// carries the old red `danger` styling: no switch breaks anything any more. Keys read 1 to 5
// straight down the rail and the beats press them in that order, so smart EOT sits at 3,
// immediately left of the eager switch it has to enable.
const SWITCHES: { name: ToggleName; label: string; key: string }[] = [
  { name: 'bargeIn', label: 'barge-in', key: '1' },
  { name: 'keyterms', label: 'keyterms', key: '2' },
  { name: 'smartEot', label: 'smart EOT', key: '3' },
  { name: 'eagerEot', label: 'eager EOT', key: '4' },
  { name: 'multilingual', label: 'multilingual', key: '5' },
]

const SLIDERS: { name: ToggleName; label: string; min: number; max: number }[] = [
  { name: 'eagerEotThreshold', label: 'eager', min: 0.3, max: 0.9 },
  { name: 'eotThreshold', label: 'eot', min: 0.5, max: 0.9 },
  { name: 'eotTimeoutMs', label: 'timeout', min: 500, max: 10000 },
]

/** How long the frozen trace takes to draw itself in, matching replayTrace() on the page. */
const revealMs = (spanMs: number) => Math.max(800, Math.min(6000, spanMs * 4))

/** Cut the polyline at `progress` so the line draws left to right without needing getTotalLength. */
function revealed(pts: TracePoint[], progress: number): TracePoint[] {
  if (pts.length < 2 || progress >= 1) return pts
  if (progress <= 0) return []
  const span = pts[pts.length - 1].dt || 1
  const cut = span * progress
  const out: TracePoint[] = []
  for (let i = 0; i < pts.length; i++) {
    if (pts[i].dt <= cut) {
      out.push(pts[i])
      continue
    }
    const prev = pts[i - 1]
    if (!prev) break
    const f = (cut - prev.dt) / (pts[i].dt - prev.dt)
    out.push({ dt: cut, c: prev.c + (pts[i].c - prev.c) * f })
    break
  }
  return out
}

const Trace: React.FC<{ s: DashState }> = ({ s }) => {
  const f = s.frozen
  if (!f) {
    return (
      <>
        <div id="trace-wrap" />
        <span id="trace-meta">
          –<small>no turn yet</small>
        </span>
      </>
    )
  }

  const x = (dt: number) => (dt / f.spanMs) * 1000
  const y = (c: number) => 100 - Math.max(0, Math.min(1, c)) * 100
  const progress = f.samples === 0 ? 1 : (s.tMs - f.frozenAtMs) / revealMs(f.spanMs)
  const line = revealed(f.pts, progress)
  const thrY = 100 - f.threshold * 100

  return (
    <>
      <div id="trace-wrap" className="on">
        <svg id="trace" viewBox="0 0 1000 100" preserveAspectRatio="none">
          <line className="thr" x1="0" y1={thrY} x2="1000" y2={thrY} vectorEffect="non-scaling-stroke" />
          <polyline
            className="line"
            points={line.map((p) => `${x(p.dt).toFixed(1)},${y(p.c).toFixed(1)}`).join(' ')}
            vectorEffect="non-scaling-stroke"
          />
          <g>
            {f.ticks.map((p, i) => (
              <line
                key={i}
                className="tick"
                vectorEffect="non-scaling-stroke"
                x1={x(p.dt).toFixed(1)}
                x2={x(p.dt).toFixed(1)}
                y1={(y(p.c) - 5).toFixed(1)}
                y2={(y(p.c) + 5).toFixed(1)}
              />
            ))}
          </g>
          <line className="fire" x1="1000" y1="0" x2="1000" y2="100" vectorEffect="non-scaling-stroke" />
        </svg>
      </div>
      <span id="trace-meta">
        {f.samples === 0 ? '0' : f.lastC.toFixed(2)}
        <small>
          {f.samples === 0
            ? 'samples. the turn was shorter than one report.'
            : `fired after ${Math.round(f.latencyMs)} ms, on ${f.samples} sample${f.samples === 1 ? '' : 's'}`}
        </small>
      </span>
    </>
  )
}

/**
 * The transcript zones scroll to the tail rather than clipping, matching setCaller() on the
 * live page. A render is a fresh frame every time, so this has to run on every frame rather
 * than on mount, or a long turn shows its first line while the app would show its last.
 */
function useScrollToTail(text: string) {
  const ref = React.useRef<HTMLDivElement>(null)
  React.useLayoutEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight
  })
  void text
  return ref
}

export const Dashboard: React.FC<{ state: DashState; height?: number }> = ({ state: s, height }) => {
  const callerRef = useScrollToTail(s.caller.text)
  const agentRef = useScrollToTail(s.agent.text)
  const sliderVal = (name: ToggleName) =>
    name === 'eotTimeoutMs' ? String(s.toggles[name]) : Number(s.toggles[name]).toFixed(2)

  return (
    <div style={{ height: height ?? '100%', width: '100%' }}>
      <style>{dashboardCss}</style>
      <div className="dash">
        <header>
          <h1>Your Demo Works. Your Callers Don&rsquo;t.</h1>
          <div className="right">
            <span id="conn" data-state={s.conn}>
              {s.conn === 'live' ? 'live' : s.conn === 'connecting' ? 'connecting' : 'dashboard socket down'}
            </span>
            <span id="lang">
              {s.languages.map((l) => (
                <span key={l}>{l}</span>
              ))}
            </span>
            <span id="state" data-state={s.agentState}>
              {s.stateLabel}
            </span>
          </div>
        </header>

        <div id="toggles">
          {SWITCHES.map((sw) => {
            // The live page dims eager EOT until smart EOT is on, because validateToggle
            // refuses the pair in either order. The rail has to show that, or the video
            // implies a switch the presenter cannot actually press yet.
            const pending = sw.name === 'eagerEot' && !s.toggles.smartEot
            return (
              <span
                key={sw.name}
                className={`sw${pending ? ' pending' : ''}${s.toggles[sw.name] ? ' on' : ''}`}
              >
                <span className="track" />
                <span className="lbl">{sw.label}</span>
                <kbd>{sw.key}</kbd>
              </span>
            )
          })}
          {SLIDERS.map((sl) => {
            const v = Number(s.toggles[sl.name])
            const pos = ((v - sl.min) / (sl.max - sl.min)) * 100
            return (
              <span key={sl.name} className="sl">
                {sl.label}
                <span className="range">
                  <i style={{ left: `${Math.max(0, Math.min(100, pos))}%` }} />
                </span>
                <span className="out">{sliderVal(sl.name)}</span>
              </span>
            )
          })}
          {s.applied ? (
            <span id="applied" style={{ color: s.applied.ok ? 'var(--listening)' : 'var(--interrupted)' }}>
              {s.applied.text}
            </span>
          ) : null}
        </div>

        <main>
          <section className="turn">
            <div className="who">Caller</div>
            <div
              id="caller"
              ref={callerRef}
              className={`text${s.caller.interim ? ' interim' : ''}${s.caller.empty ? ' empty' : ''}`}
            >
              {s.caller.text}
            </div>
          </section>
          <section className="turn">
            <div className="who">Agent</div>
            <div id="agent" ref={agentRef} className={`text${s.agent.empty ? ' empty' : ''}`}>
              {s.agent.text}
              {s.agent.cut ? <span className="cut">&#10229; heard up to here</span> : null}
            </div>
          </section>
        </main>

        <div className="bar-wrap">
          <span className="bar-label">End of turn confidence</span>
          <div id="bar">
            <i style={{ width: `${Math.round(s.conf * 100)}%` }} />
            <b style={{ left: `${s.toggles.eotThreshold * 100}%` }} />
          </div>
          <span id="conf">{s.conf.toFixed(2)}</span>

          <span className="trace-label">
            Last turn <kbd>R</kbd>
          </span>
          <Trace s={s} />
        </div>

        <footer>
          <div className="stat">
            <span className="k">End of turn</span>
            <span className="v">
              {s.eotMs === null ? '–' : Math.round(s.eotMs)}
              <small> ms</small>
            </span>
          </div>
          <div className="stat">
            <span className="k">EOT p50 / p90 / p95</span>
            <span className="v">{s.eotPercentiles ? s.eotPercentiles.join(' / ') : '–'}</span>
          </div>
          <div className="stat">
            <span className="k">LLM first token</span>
            <span className="v">
              {s.ttftMs === null ? '–' : Math.round(s.ttftMs)}
              <small> ms</small>
            </span>
          </div>
          <div className="stat">
            <span className="k">TTS first byte</span>
            <span className="v">
              {s.ttfbMs === null ? '–' : Math.round(s.ttfbMs)}
              <small> ms</small>
            </span>
          </div>
          <div className="stat">
            <span className="k">Speculative issued / used</span>
            <span className="v">
              {s.specIssued} / {s.specUsed}
            </span>
          </div>
          <div className="stat">
            <span className="k">Socket uptime</span>
            <span className="v">{s.uptimeS === null ? '–' : mmss(s.uptimeS)}</span>
          </div>
          <div className="stat">
            <span className="k">Reconnects</span>
            <span className="v">{s.reconnects}</span>
          </div>
          {s.degraded ? <span id="degraded">{s.degraded}</span> : null}
        </footer>
      </div>
    </div>
  )
}
