# docs/ — read this first

This directory is the handoff from planning into code. Everything a fresh session needs to
start building is in here. **You should not need to read anything outside `docs/` to write the
first line of code**, though the planning repo holds the reasoning if you want it.

## What we are building, in one sentence

> **My demo will show the same voice agent break on real callers and get fixed mid-call, without a reconnect.**

Longer form: My demo will show a working voice agent failing four ways real callers make it fail, then getting fixed live on the same open call by flipping a switch, not by hanging up or touching code. If a feature does not
help that sentence land, it does not get built. Settled with Sam on 2026-09-10.

## What we are building, in one paragraph

A live stage demo for a 20 minute talk called **"Your Demo Works. Your Callers Don't."** A real
phone call comes in to a Vonage number. A voice agent answers it, using Deepgram Flux to listen
and Flux TTS to speak. On stage the presenter deliberately breaks the agent four times in ways
the audience recognizes, then **fixes three of them live, on the open socket, without dropping the
call, and tunes the fourth**. Beat 3 is the tradeoff, not a fix: nothing is broken there, it just
has a bill. A browser window shows what is happening in type large enough to read from
the back of the room.

This is a stage prop, not a product. Optimise for a presenter under pressure in a room with bad
wifi, not for architecture.

## Read order

1. `README.md` (this file) — orientation and the decisions already made
2. `RUN-OF-SHOW.md` — the 20 minutes, beat by beat. **Read before designing anything.** Every
   feature exists to serve a specific beat, and if it does not serve one, cut it
3. `SPEC.md` — architecture, modules, event contract, toggle contract
4. `API-NOTES.md` — verified Deepgram and Vonage facts, and the traps that will cost you an hour
5. `PHASES.md` — ordered build phases with exit criteria
6. `ENV.md` — credentials, env vars, local dev loop
7. `SCRIPT.md` — what the presenter says into the phone, beat by beat, and the fictional account

## Decisions already made, do not relitigate

| Decision | Answer | Why |
|---|---|---|
| Stack | **TypeScript on Node** | One language across the telephony webhooks, both Deepgram sockets, the event bus and the dashboard, in one process. That is what the constraints actually ask for. This is the spec making the call that `docs/open-questions.md` Q5 left open |
| Telephony | **Vonage Voice API** | Co-hosted partner event, so the better-together story matters. There is a published Vonage guide for Deepgram voice agents to start from |
| Speech in | **Deepgram Flux** (`flux-general-en`) | Model-integrated end-of-turn detection is the whole point. Not Nova-3 |
| Speech out | **Deepgram Flux TTS** | Conversation-native, and its `Interrupt` message is what beat 1 depends on |
| Framework | **None** | Every abstraction between us and the raw websocket events is a layer we cannot instrument or break on purpose |
| Process count | **One** | One process, one port, one browser window |
| Persistence | **None** | In-memory only. The demo is 20 minutes long and then it is over |

## Still open, and who decides

- **Nothing blocking the code.** Build against the spec.
- **A real Vonage number.** Not provisioned yet as of 2026-09-10, and it is the top blocker.
  A Vonage trial account cannot rent a number and cannot accept calls from anyone but the account
  holder, so audience participation is impossible on a trial.
  **Until it lands, build against the local harness described in `ENV.md`.**
- **The two pocket beats** (background noise, mid-call language switch) are explicitly out of
  scope for the first build. Do not build them. They come back only if a primary beat gets cut.

## Hard constraints, non-negotiable

1. **20 minutes total.** Every feature competes for seconds.
2. **No live coding on stage.** Every on-stage change is a pre-wired toggle in the browser. If a
   beat needs a file edit or a restart, the beat is wrong.
   **Under review as of 2026-09-22**, because Liz is live coding in the slot before ours and
   assumes we are too. See `LIVE-CODING.md`. The part of this constraint that is not negotiable
   either way is the **restart**: `node --watch` restarts on a file save and a restart drops the
   call, which breaks constraint 3. Any live editing has to be a file the running process reads,
   not a file it imports.
3. **No reconnects mid-beat.** All four on-stage changes apply to a socket that stays open. This
   is the single most important technical requirement in the whole build. (An earlier version of
   this line said "three of the four", inherited from a comparison table in the planning repo. It
   was wrong: `SPEC.md` is correct that every toggle applies without a reconnect. The three-versus-
   four distinction is about fixes versus the beat 3 tradeoff, not about reconnects.)
4. **Readable from 15 feet on a bad projector.** Test by screenshotting the dashboard at 25% and
   checking you can still read it.
5. **Degrade, never crash.** A dropped Deepgram socket should show as a visible degraded state,
   not a stack trace on a projector.
6. **Do not build "how to build a voice agent."** Vonage presents immediately after us with a
   published happy-path guide behind them. Anything that duplicates their build is wasted time.

## Things that must not appear on screen or in the UI

- Any pricing. Flux TTS pricing changed on 2026-09-13 and anything price-related will be stale.
- The Nova-3 "54.2% WER reduction" figure. Unvalidated, and it predates Flux.
- The `flux-voice-explorer` speech-recognition match rate. Two sources disagree and it is stored
  nowhere.

## Event facts, for anything that renders a date

- SF: Tue Oct 6 2026, a private office. Known network, scoutable room.
- LA: Thu Oct 15 2026, a restaurant at midday hosting a full-day multi-sponsor summit.

Venue addresses and arrival times are deliberately not in this repo. They belong to the event
organisers, not to us, and this repo is public. The private planning repo has them.
- LA is filmed by the venue and has walk-through traffic. **Design for LA.**
