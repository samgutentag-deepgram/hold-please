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
    Dashboard.tsx        the app's markup, re-rendered from a replay state
    OrientationStrip.tsx the every-frame header: what this is, which beat, how far in
    ToggleMoment.tsx     the close-up of the switch moving, with the no-reconnect proof
    CompareCard.tsx      the frozen before/after still
    Caption.tsx          the burned-in caption band (the video is silent on purpose)
    Chrome.tsx           the BROKEN / FIXED chip
  scenes/
    ColdOpen.tsx    six seconds of the failure, no caption, before the title
    TitleCard.tsx   the opener and the per-beat cards
    Beat.tsx        title -> one continuous call -> compare still
    Checklist.tsx   the four questions from docs/SCRIPT.md
    Outro.tsx       repo and startup programs
    Master.tsx      the loop, and the timeline the strip reads
  fixtures/
    beats.ts        the four beats as event timelines
    fromJsonl.ts    the migration path onto real recordings
```

**The loop is built for someone who arrives at a random frame.** At The Kinn a viewer is
standing, about 15 feet away, with no audio, and will leave before the loop comes round. So
the orientation strip is on every frame rather than being a card at the start, and the cold
open opens on the failure rather than on a title. `Master.tsx` builds one `TIMELINE` array
that both `Series` and the strip read, so a duration change cannot leave the strip announcing
the wrong section.

**Pinning the transcript to the tail needs `delayRender`.** The live page sets `scrollTop` in
`setCaller()`. In a render, a scrollTop measured before the webfonts land is measured against
the wrong line heights and comes out as zero, which shows the head of a long turn where the
app shows the tail. `useTailPin` in `Dashboard.tsx` holds the frame until
`document.fonts.ready`, then pins. Short turns do not overflow, so it is a no-op and they
stay top aligned exactly as in the app.

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

## The running order is derived, not written down twice

`ORDER` in `fixtures/beats.ts` is the sequence: barge-in, keyterms, the rambler, the false
start. Everything else follows from it. A beat's number is its index, so captions and compare
cards cannot drift out of sync with the order, and `carryIn(order, i)` computes which switches
are already on when a beat's call starts, so no beat stores a starting state.

That order is forced rather than chosen. `eagerEot` is refused unless `smartEot` is on, so the
false start cannot run before the rambler without borrowing the rambler's own reveal. Moving
the sequence again is one line, and nothing else needs touching.

## Copy is stale and is going to be rewritten

The fixtures still use the old fiction, an electric utility with kilowatt hours and meter
reads. The demo's account is now **Bramble Hill Pet Lodge**, a dog boarding business, and the
dog is a pug called Brisket, for continuity with the Vonage talk that follows. Keyterms are
`Gutentag, Bramble Hill, Brisket`.

`docs/SCRIPT.md` carries a banner saying it is stale, so do not pull caption copy from it yet.
The beat shapes hold and the words do not. Recut captions once the script lands, not before,
or you will do it twice.

## Adding a QR to the outro

Drop a PNG at `public/qr.png` and pass `qr` to `<Outro />` in `scenes/Master.tsx`.
