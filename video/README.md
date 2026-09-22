# video/ — the booth loop and the stage fallbacks

A Remotion project that renders the demo as video: one continuous loop for a booth screen or a
background during a talk, and one MP4 per beat for the Phase 6 fallback, cut from the same
source so they can never drift.

Nothing in here is part of the demo. `video/` is its own pnpm root with its own lockfile, so
`pnpm install` at the repo root still gets you one dependency.

## Licensing, read this first

**Remotion is not free for companies.** It is free for individuals and companies with up to
three employees; anything larger needs a paid company licence. Before this ships as a Deepgram
booth asset, that needs sorting. See <https://remotion.dev/license>.

## Run it

```bash
cd video
pnpm install
pnpm studio           # scrub the timeline, tune a fixture, see changes live
pnpm render:master    # out/hold-please-loop.mp4   — the ~3:10 booth loop
pnpm render:beats     # out/beat-N-*.mp4           — one per beat, for the stage
```

`pnpm studio` is where the work happens. Every fixture timestamp is in milliseconds and
scrubbing lands on exactly the frame a render produces, because the replay is a pure function
of time.

## How it is put together

```
src/
  types.ts          the event contract, copied from ../src/bus/events.ts
  replay.ts         events + a time in ms -> the exact state the dashboard would be in
  dashboardCss.ts   the app's stylesheet, verbatim
  components/
    Dashboard.tsx   the app's markup, re-rendered from a replay state
    ToggleMoment.tsx the close-up of the switch moving, with the no-reconnect proof
    CompareCard.tsx  the frozen before/after still
    Caption.tsx      the burned-in caption band (the video is silent on purpose)
    Chrome.tsx       the BROKEN / FIXED chip
  scenes/
    TitleCard.tsx   the opener and the per-beat cards
    Beat.tsx        title -> one continuous call -> compare still
    Checklist.tsx   the four questions from docs/SCRIPT.md
    Outro.tsx       repo and startup programs
    Master.tsx      the loop
  fixtures/
    beats.ts        the four beats as event timelines
    fromJsonl.ts    the migration path onto real recordings
```

**The dashboard is one mounted component for a whole beat.** That is deliberate. The socket
uptime counter climbs straight through the fix, and "I did not reconnect" is the claim the room
finds hardest to believe, so the video must not cheat it with a remount.

**`replay.ts` is a port of the dashboard's own `apply()`.** Same switch, same fields, same
percentile maths. If the two ever disagree the video is lying, so port changes across rather
than reimplementing.

## Fixtures now, recordings later

`fixtures/beats.ts` holds hand-authored timelines. Every number in them comes from a source in
`docs/`: transcripts and agent lines from `SCRIPT.md`, latencies from the published Flux figures
in `API-NOTES.md`, failure shapes from `RUN-OF-SHOW.md`. Nothing is invented to look good.

Once a beat has been captured on a real call, the recorder's `recordings/*-events.jsonl` drops
straight in:

```ts
import { fromJsonl } from './fromJsonl.ts'
events: fromJsonl(await (await fetch(staticFile('beat2.jsonl'))).text(), { zeroAtMs: 41_200 })
```

Nothing else changes. `zeroAtMs` is the moment in the recording where the beat should start;
it keeps the uptime counter warm instead of showing 0:00 on frame one.

## Known issue, and it is the app's, not the video's

A long caller turn overflows the transcript zone and gets cut mid-glyph, worst when the
"applied live, no reconnect" banner is on screen and stealing a row. Beat 4's ramble is long
enough to hit it. The video inherits it because it inherits the stylesheet. Fixing
`.text { overflow: hidden }` in `src/web/public/index.html` fixes both; re-copy the block into
`dashboardCss.ts` afterwards.

## Adding a QR to the outro

Drop a PNG at `public/qr.png` and pass `qr` to `<Outro />` in `scenes/Master.tsx`.
