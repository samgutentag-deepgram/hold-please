# Phases

Ordered. Each has an exit criterion you can demonstrate rather than assert. Do not start a phase
before its predecessor's exit criterion is met.

Dates assume a **build freeze around Sep 15** and the first delivery on **Oct 6**. Today is
Sep 10, so Phase 0 and 1 are the urgent ones.

---

## Phase 0 — Scaffold

Node plus TypeScript, one process, one port. No framework. Add the package manifest deliberately;
the planning repo never had one by design.

**Exit:** `npm run dev` starts a server, serves an empty dashboard page, and logs one typed event
from the bus with a monotonic timestamp.

**Status: met 2026-09-10.** `npm run dev` boots one process on one port, serves `src/web/public/index.html`,
and logs `process.started` from the bus with a `performance.now()` timestamp. The dashboard socket at
`/ws/dashboard` replays the log to a late-joining browser. `npm run check` typechecks and runs four
bus tests.

---

## Phase 1 — The spine

An agent that answers a real phone call, holds a 30 second conversation, and hangs up cleanly.
Flux STT in, one LLM turn, Flux TTS out.

**Blocked on a real Vonage number.** Until it lands, use the local harness in `ENV.md` so this
phase can proceed against a mic and speakers rather than a phone.

**Exit:** call a real number, say three things, get three sensible spoken answers, hang up. No
crashes, no orphaned sockets.

**Status 2026-09-10: built, not yet exercised against the APIs.** The spine exists end to end: audio
leg (Vonage or `--local`), Flux STT with live `configure()`, the LLM turn, Flux TTS with `Interrupt`
and the playback clock it needs, barge-in, and a canned line when the LLM fails. Typechecks, and the
socket protocol is covered by tests against a fake websocket. What it has not had is a key: no
`DEEPGRAM_API_KEY` or `ANTHROPIC_API_KEY` was available in the build session, so the first
`npm run dev -- --local` with real credentials is the next step, and the real-number exit criterion
still waits on the Vonage account.

---

## Phase 2 — Instrumentation

Every boundary in the `DemoEvent` union emits, with one monotonic clock. Streamed to the browser
over the control socket.

**Exit:** a full call produces a complete ordered event log, and every event in the union has been
observed at least once. Two clocks anywhere is a bug, not a detail.

---

## Phase 3 — The dashboard

One page, four zones, no scroll. Transcript dominant, state pill, confidence bar, stats strip.

**Exit:** screenshot the page, scale it to 25%, and read the transcript and the state pill without
squinting. If you cannot, the type is too small. This is the actual test, not a proxy for one.

---

## Phase 4 — Toggles, and beat 2 first

Every toggle in the contract, applying live with no reconnect. **Build beat 2 before the others**,
because it is the centrepiece and because it is the one that proves the hard requirement.

**Exit:** with a call up, flip keyterms on, and see `config.applied` arrive with
`reconnected: false` while the uptime counter keeps ticking. Then read a code that failed a minute
ago and watch it come back correct on the same call.

**Status 2026-09-10: built, exit not yet demonstrated.** All seven toggles exist in
`src/toggles/state.ts`, validated (eager can never exceed eot, in either order), broadcast as
`toggle.changed`, and applied to the live socket through `stt.configure()` from `src/call.ts`.
`multilingual` is the one exception: the model is a connection parameter, so it reconnects and says
so with `reconnected: true`. The dashboard has the toggle row, keys 1 to 4 for the four switches,
and the eager slider's maximum is bound to the eot slider. `bargeIn` and `smartEot` are implemented in the loop as
a 1200 ms silence timer with no barge-in. Beat 2 needs a live run with the code in
`docs/SCRIPT.md` to close the exit criterion.

---

## Phase 5 — The other three beats

Beat 1 barge-in with `text_spoken` on screen. Beat 3 speculative execution visible and counted.
Beat 4 confidence bar plus live parameter tuning.

Also: the invalid `eager_eot_threshold` above `eot_threshold` combination must be unreachable from
the UI.

**Exit:** all four beats runnable back to back on one call, in the run-of-show order, inside 14
minutes.

**Status 2026-09-10: the mechanics exist, none of the beats have been run.** Barge-in with
`text_spoken` on screen worked on the first live run of Phase 1. Eager speculation, the
issued-versus-used counter, and the live threshold dials landed with Phase 4. The invalid
threshold combination is unreachable from the UI and rejected by the store. What remains is
rehearsal: `docs/SCRIPT.md` has the lines.

---

## Phase 6 — Fallbacks and audio

Recorded MP4 of every beat in both the default and the fixed state, cut so any single beat can be dropped in
without breaking the narrative.

Audio path hardening: headset in, server tee to the PA, mute-while-speaking guard, PA bleed test.
A battery PA speaker is the backstop.

Degrade behaviour: every socket drop shows a visible banner and attempts backoff reconnect. No
stack traces on the projector.

**Exit:** unplug the network mid-beat and watch the page degrade visibly rather than crash. Then
run the whole talk from video alone, start to finish, without touching the app.

---

## Phase 7 — Rehearsal and the cold run

Ten runs per beat, using inputs chosen because they fail deterministically rather than usually. If
a beat will not fail reliably after ten attempts, cut it and promote a pocket beat.

Then the two conditions that only fail for real:

1. Run the whole thing on a phone tether rather than good wifi
2. Leave it running for 45 minutes before starting, because that is what happens while you wait to
   be introduced

**Exit:** the definition of done below, all boxes ticked.

---

## Definition of done

- [ ] Runs end to end on a real phone call to a real number
- [ ] Every stage boundary is timestamped and rendered live in the browser
- [ ] Every on-stage change is a toggle, not a code edit
- [ ] The dashboard is legible in a screenshot scaled to 25%
- [ ] A full clean run is recorded as MP4 and can be cut to without breaking the narrative
- [ ] It has been run cold on a phone tether rather than good wifi
- [ ] It survives being left running 45 minutes before the presenter is introduced
- [ ] Each of the four beats has failed on cue ten times in a row
- [ ] The invalid eager/eot threshold combination cannot be reached from the UI
