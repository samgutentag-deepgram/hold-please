// Copied from src/web/public/index.html, one change only: the `html, body` rules become
// `.dash`, because here the dashboard is a box inside a 1920x1080 frame rather than the page.
// Everything else is byte-for-byte the app. When the app's styles change, re-copy the block
// rather than hand-patching this, or the video stops being a picture of the real thing.

export const dashboardCss = `
:root {
  --bg: #0b0d10; --fg: #f4f6f8; --dim: #8b949e; --line: #1f242b;
  --listening: #3fb950; --thinking: #f0b429; --speaking: #58a6ff; --interrupted: #f85149; --idle: #6e7681;
  --caller: #f4f6f8; --agent: #79c0ff;
}
.dash * { box-sizing: border-box; }
.dash {
  height: 100%; width: 100%; margin: 0;
  background: var(--bg); color: var(--fg);
  font: 500 24px/1.35 system-ui, -apple-system, "Segoe UI", sans-serif;
  display: grid; grid-template-rows: auto auto 1fr auto auto; gap: 18px;
  padding: 24px 40px 20px; overflow: hidden;
}
.dash header { display: flex; align-items: center; justify-content: space-between; gap: 24px; }
.dash h1 { margin: 0; font-size: 28px; letter-spacing: -0.01em; color: var(--dim); font-weight: 600; }
.dash .right { display: flex; align-items: center; gap: 18px; }
#lang { display: flex; gap: 6px; align-items: center; }
#lang span { font: 800 16px/1 ui-monospace, SFMono-Regular, Menlo, monospace; text-transform: uppercase; padding: 6px 10px; border-radius: 8px; border: 2px solid var(--line); color: var(--dim); }
#lang span:first-child { color: var(--fg); border-color: var(--fg); font-size: 20px; }
#state {
  font: 800 30px/1 system-ui, sans-serif; letter-spacing: 0.04em; text-transform: uppercase;
  padding: 12px 28px; border-radius: 999px; color: #000; background: var(--idle); min-width: 240px; text-align: center;
}
#state[data-state="listening"] { background: var(--listening); }
#state[data-state="thinking"] { background: var(--thinking); }
#state[data-state="speaking"] { background: var(--speaking); }
#state[data-state="interrupted"] { background: var(--interrupted); }
#conn { font-size: 16px; color: var(--dim); }
#conn[data-state="disconnected"] { color: var(--interrupted); font-weight: 700; }

#toggles { display: flex; flex-wrap: wrap; align-items: center; gap: 10px 14px; font-size: 15px; }
.sw { display: inline-flex; align-items: center; gap: 10px; user-select: none; font: 700 15px/1 system-ui, sans-serif; color: var(--fg); padding: 4px 6px 4px 4px; border-radius: 12px; }
.sw .track { position: relative; width: 74px; height: 32px; border-radius: 999px; background: #2a3038; border: 2px solid var(--line); flex: none; }
.sw .track::before { content: ''; position: absolute; top: 3px; left: 3px; width: 22px; height: 22px; border-radius: 50%; background: var(--dim); }
.sw .track::after { content: 'OFF'; position: absolute; right: 9px; top: 0; bottom: 0; display: flex; align-items: center; font: 800 11px/1 system-ui, sans-serif; letter-spacing: 0.08em; color: var(--dim); }
.sw.on .track { background: var(--speaking); border-color: var(--speaking); }
.sw.on .track::before { left: 45px; background: #000; }
.sw.on .track::after { content: 'ON'; left: 11px; right: auto; color: #000; }
.sw kbd { font: 700 11px/1 ui-monospace, Menlo, monospace; color: var(--dim); border: 1px solid var(--line); border-radius: 4px; padding: 2px 5px; }
/* eager EOT cannot be switched on before smart EOT: speculation is promoted at EndOfTurn and
   the silence timer never produces one. The rail dims it rather than letting it be pressed. */
.sw.pending { opacity: 0.45; }
.sl { display: inline-flex; align-items: center; gap: 8px; color: var(--dim); font: 700 13px/1 system-ui, sans-serif; letter-spacing: 0.06em; text-transform: uppercase; }
.sl .range { width: 130px; height: 6px; border-radius: 999px; background: #2a3038; position: relative; }
.sl .range i { position: absolute; top: 50%; width: 16px; height: 16px; margin: -8px 0 0 -8px; border-radius: 50%; background: var(--speaking); }
.sl .out { font: 700 15px/1 ui-monospace, Menlo, monospace; color: var(--fg); min-width: 5ch; text-align: right; font-variant-numeric: tabular-nums; }
#applied { color: var(--listening); font-weight: 700; font-size: 14px; }
.dash main { display: grid; grid-template-rows: 1fr 1fr; gap: 20px; min-height: 0; }
.turn { display: grid; grid-template-rows: auto 1fr; gap: 8px; min-height: 0; border-top: 2px solid var(--line); padding-top: 12px; }
.who { font: 700 16px/1 system-ui, sans-serif; letter-spacing: 0.12em; text-transform: uppercase; color: var(--dim); }
.text { font-size: clamp(34px, 4.2vw, 64px); line-height: 1.15; font-weight: 700; overflow: hidden; text-wrap: balance; }
/* A 45 second ramble overflows this zone and used to clip mid-glyph, worse once the
   "applied live, no reconnect" banner takes a row. Scroll to the tail instead of clipping.
   The video pins scrollTop the way setCaller() does on the live page; see Dashboard.tsx. */
.text { overflow-y: auto; overscroll-behavior: contain; min-height: 0; }
#caller { color: var(--caller); }
#caller.interim { color: var(--dim); font-weight: 500; }
#agent { color: var(--agent); }
#agent .cut { color: var(--interrupted); font-weight: 500; font-size: 0.6em; margin-left: 0.4em; vertical-align: middle; }
.empty { color: var(--dim); font-weight: 500; }

.bar-wrap { display: grid; grid-template-columns: auto 1fr auto; grid-template-rows: auto auto; align-items: center; gap: 12px 16px; }
.trace-label { font: 700 16px/1 system-ui, sans-serif; letter-spacing: 0.12em; text-transform: uppercase; color: var(--dim); white-space: nowrap; }
#trace-wrap { grid-column: 2; height: 72px; visibility: hidden; }
#trace-wrap.on { visibility: visible; }
#trace { width: 100%; height: 72px; display: block; background: var(--line); border-radius: 8px; }
#trace .thr  { stroke: var(--thinking); stroke-width: 2; stroke-dasharray: 7 6; }
#trace .line { fill: none; stroke: var(--listening); stroke-width: 4; stroke-linejoin: round; stroke-linecap: round; }
#trace .tick { stroke: var(--listening); stroke-width: 4; stroke-linecap: round; }
#trace .fire { stroke: var(--interrupted); stroke-width: 4; }
#trace-meta { font: 700 20px/1.2 ui-monospace, SFMono-Regular, Menlo, monospace; color: var(--fg); white-space: nowrap; text-align: right; }
#trace-meta small { display: block; font: 500 13px/1.4 system-ui, sans-serif; color: var(--dim); }
.dash kbd { font: 700 12px/1 ui-monospace, Menlo, monospace; border: 1px solid var(--dim); border-radius: 4px; padding: 2px 5px; color: var(--dim); }
.bar-label { font: 700 16px/1 system-ui, sans-serif; letter-spacing: 0.12em; text-transform: uppercase; color: var(--dim); white-space: nowrap; }
#bar { height: 28px; border-radius: 999px; background: var(--line); overflow: hidden; position: relative; }
#bar i { display: block; height: 100%; width: 0%; background: linear-gradient(90deg, #1b998b, #3fb950); }
#bar b { position: absolute; top: 0; bottom: 0; width: 3px; background: var(--thinking); left: 70%; }
#conf { font: 700 24px/1 ui-monospace, SFMono-Regular, Menlo, monospace; min-width: 4ch; text-align: right; font-variant-numeric: tabular-nums; }

.dash footer { display: flex; flex-wrap: wrap; gap: 28px 40px; align-items: baseline; font-variant-numeric: tabular-nums; }
.stat { display: grid; gap: 2px; }
.stat .k { font: 700 13px/1 system-ui, sans-serif; letter-spacing: 0.12em; text-transform: uppercase; color: var(--dim); }
.stat .v { font: 700 26px/1 ui-monospace, SFMono-Regular, Menlo, monospace; }
.stat .v small { font-size: 14px; color: var(--dim); font-weight: 500; }
#degraded { background: var(--interrupted); color: #000; font-weight: 800; padding: 10px 16px; border-radius: 10px; }
`
