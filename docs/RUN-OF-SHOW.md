# Run of show

20 minutes. This document is the requirements source: every feature in `SPEC.md` exists to serve
a beat below. If a proposed feature does not map to a beat, it does not get built.

| Time | Beat | What the app must do |
|---|---|---|
| 0:00 to 1:30 | **"Every demo works."** One slide, then slides close for good | Warm, with a call already up. Optional: the Gutentag gag, see below |
| 1:30 to 5:00 | **Beat 1, barge-in** | Naive mode on, then off |
| 5:00 to 8:30 | **Beat 2, the confirmation code** | Keyterms pushed mid-call |
| 8:30 to 12:00 | **Beat 3, the rambler** | Smart EOT on, then params tuned mid-call |
| 12:00 to 15:00 | **Beat 4, the false start** (the trade, not a fix) | Eager EOT on, the bill made visible |
| 15:00 to 17:30 | **The checklist.** One slide, all four failures as a pre-launch checklist | Nothing |
| 17:30 to 20:00 | **Handoff.** QR to the repo, both startup programs | Nothing |

Beats 1, 2 and 4 run the same four-step shape: **break it, name why, fix it, run it again.**
Beat 3 is deliberately the odd one out: **nothing breaks, and you tune rather than fix.** Three
fixes and one tradeoff, and say which is which on stage. Roughly
3:20 per beat. The app has to make each of those four steps visible without narration carrying
the whole load, because half the room is reading rather than listening.

---

## The opener, optional: Gutentag triggers German

Sam's surname is Gutentag. It is German, he does not speak German, and it is homophone-adjacent to
"guten Tag". Running `flux-general-multi` with the live language readout on screen means saying his
own name in the introduction may flip the language indicator to German.

Worth doing for two reasons beyond the laugh. It happens in the first 30 seconds, which is exactly
when a walk-through audience in LA decides whether to keep watching. And it teaches the room that
the transcript panel is live and worth their attention, which every later beat depends on.

It also quietly rescues the pocket beat. A mid-call language switch was cut because it needed a
volunteer to perform on cue. Triggering it with his own name removes the dependency entirely.

**Three honest caveats, in order of how much they matter:**

1. **It may simply not fire.** Flux may transcribe "Gutentag" as an English proper noun and never
   flag German. **First test, 2026-09-10, on Sam's voice: it did not fire.** A Spanish sentence did
   flip the readout to ES, so the mechanism works and the surname does not. Do not write it into a
   rehearsal script until it has fired three times in a row.
2. **It requires the multilingual model.** `flux-general-multi` is a different model from
   `flux-general-en` and turn-detection behaviour may differ. All four beats depend on turn
   detection. **If the multi model degrades any beat, the beats win and the gag is cut.** Test this
   second, right after testing whether it fires at all.
3. **Never lean on it.** If it does not fire on the night, say the line and move on. A gag that
   needs explaining is worse than no gag.

Implementation is already in the spec: the `stt.languages` event, sourced from the `languages`
field on every `TurnInfo`, rendered as a small language code beside the state pill.

**Granularity, checked 2026-09-10:** `flux-general-multi` reports `languages` per turn, sorted by
word count. Words carry no language field, so the readout cannot color individual words; it shows
the turn's languages as chips, dominant first, and flashes when the set changes. Probed with an
English TTS voice saying "Guten Tag, my name is Sam Gutentag": the model reported `en` only and
transcribed "Guten tag". The gag still needs a human voice to fire or not (`scripts/multi-probe.mjs`
is the harness; toggle multilingual on and say the name).

---

## Beat 1 — Barge-in

**On stage:** the presenter calls the number, the agent starts a long answer, the presenter talks
over it mid-sentence.

**Broken (`bargeIn` off, the default):** the agent either keeps talking over the caller, or stops and loses its
place, then repeats itself or answers the wrong question.

**Fixed (`bargeIn` on):** Flux's `StartOfTurn` fires reliably, TTS is cut, and the `Interrupt`
server message on the speak socket carries `text_spoken`, which is exactly what the caller heard
before cutting in. The agent resumes from there instead of from the top.

**What the app must show:** the value of `text_spoken` on screen, large, the moment it arrives.
That single field is the beat. Also a visible state pill moving between listening, thinking and
speaking, so the room can see the barge-in land.

**Fix mechanism:** turn `bargeIn` on. No reconnect.

---

## Beat 2 — The confirmation code

**On stage:** the presenter gives the surname on the account, "Gutentag". (Originally a
confirmation code; changed 2026-09-10 after three alphanumeric codes all transcribed correctly with
keyterms off. Flux handles letters and digits on a good mic; it needs help with words it has not seen.)

**Broken:** the name comes back as a German greeting. "Gutentag" becomes "Guten Tag", the agent reads
that back, and cannot find the account.

**Fixed:** the presenter clicks one toggle that sends a `Configure` control message on the **already
open** Flux socket, adding keyterms. Says the name again. It comes back as one word, and the account opens.

**What the app must show:** the transcript before and after, side by side or stacked, so the room
sees the same input produce two different outputs. Also a small visible confirmation that the
socket did not reconnect, because that is the part that is hard to believe. A connection-uptime
counter that keeps ticking through the fix is the cheapest way to prove it.

**Fix mechanism:** `Configure` on the live socket. **This is the centrepiece of the whole talk and
the most demo-valuable capability in the stack. Build this beat first after the spine.**

---

## Beat 4 — The false start (runs third-to-last; see the order note)

**On stage:** the presenter pauses mid-sentence as if finished, then continues.

**Not broken, and say so out loud.** `EagerEndOfTurn` fires, a speculative LLM call starts, and
`TurnResumed` cancels it. Beat 3 is **the tradeoff, not a fix**. This is the one beat of the four
where nothing is wrong and nothing gets repaired. Frame it that way from the first sentence, or the
room spends the whole beat waiting for a fix that never comes.

**Say what the bill actually is.** "It costs money" is hand-waving. There are three costs and they
get progressively more interesting:

1. **Tokens you throw away.** Eager at 0.3 to 0.5 buys 150 to 250ms of perceived latency and costs
   **50 to 70% more LLM calls**. You pay for inference on turns nobody ever heard.
2. **The unit on screen, not the dollar amount.** Show **issued versus used**. Issue 10, use 6, and
   you paid for four replies that were thrown away. Never put a price on the slide: Voice Agent and
   Flux TTS pricing both moved on Sept 13 and anything in dollars will be stale on stage.
3. **Side effects you cannot take back. This is the real bill.** If a speculative turn produces a
   tool call, it dispatches immediately. A caller who false-starts mid-sentence can make your agent
   charge a card, book a slot or send an email, and *then* the turn resumes and the reply is
   discarded. The side effect is not. **Use the lodge's own version, it is a better picture than a
   credit card:** the caller pauses halfway through "I want to book Brisket in for grooming on
   Thursday, actually make it Friday", and the agent has already taken the Thursday slot. The
   pause lands *inside* the sentence, so the speculative turn fires on a value the caller is in
   the middle of retracting. The wrong thing is not merely early, it is wrong.

> **OPEN, and it is the last honesty problem in the talk.** The demo has no tool calls, so the
> dashboard never emits the booking. As written, the closing image is narration over an event
> the screen cannot show, in a talk whose whole argument is that what is on the screen can be
> trusted. Somebody will notice.
>
> Two ways out. **Build one tool**, a `book_grooming` function the speculative turn really
> dispatches and really has cancelled, rendered as two events on the stats strip. Roughly two to
> three hours, no external side effect, and it closes the gap between asserting the hazard and
> showing it. It would also give us the one panel Liz has and we do not.
>
> Or **stop asserting it**: frame the side effect explicitly as what happens in production rather
> than what just happened here. Free, weaker, and still honest.
>
> **The two are not equally costed, and the reason only shows up from the video side.** On stage
> option 2 is fine, because Sam is standing there and a person saying "this is what happens in
> production" is believed. The booth loop is silent by design, because LA is a restaurant at
> midday and a viewer arrives at a random frame from fifteen feet. Under option 2 the loop's last
> thirty seconds are a caption asserting a hazard with nothing on screen behind it, in a video
> whose credibility rests on every number having come from an event. That is the one frame where
> the loop does the thing it spends three minutes arguing against.
>
> So option 2 is free for the talk and expensive for the loop. Option 1 is two to three hours
> once and pays into the talk, the booth loop, the per-beat stage fallbacks and the shareable cut.
>
> Sam's call. Do not let the talk assert a booking the dashboard did not render. Deepgram's own guidance is to set `defer_until_eot: true` on
   anything non-idempotent, and the managed API emits `FunctionCallCancelled` so you can roll back.
   On raw sockets it is entirely your problem.

Point 3 is the 30 seconds worth keeping. It turns beat 3 from a config dial into the production
hazard the talk is named after.

**Mechanism:** adjust `eager_eot_threshold` live and re-run. It is a dial, not a repair. Note the hard constraint:
`eager_eot_threshold` must be less than or equal to `eot_threshold` or the connection errors out.
**The UI must prevent that combination rather than let the presenter break the demo on stage.**

---

## Beat 3 — The rambler (runs before the false start)

**On stage:** the presenter talks for around 45 seconds with no clean stopping point.

**Broken (`smartEot` off, the default):** the silence timer cuts them off after 1200 ms of
pause, or the agent waits forever. Flux knows the turn ended; nothing is listening to it.

**Fixed:** tune `eot_timeout_ms` and `eot_threshold` live, framed as product decisions rather than
config values.

**What the app must show:** the end-of-turn confidence climbing in real time. Every Flux `Update`
event carries `end_of_turn_confidence` roughly four times a second. Render it as a live bar. This
is the best-looking element in the whole demo and it makes "why did it fire there" visible instead
of theoretical.

**Know what you are actually rendering.** `Update` arrives about 4 times a second and end of turn
is 260ms at P50, so **a typical turn produces one or two samples**. There is no smooth ramp in the
data. The bar is already interpolating (`#bar i` has a 120ms CSS transition), so the question is
not whether to animate but how much.

**Freeze it, then replay it. Decided 2026-09-21.** Agents are too fast for a room to read at
real time, so:

- The bar runs at **real time** during the turn. Never slow the render while audio is live: if the
  bar lags the phone, the room watches the agent answer before the bar fills and the causal story
  dies.
- On `stt.endOfTurn`, **hold the trace on screen** as a frozen sparkline with a marker where it
  crossed. That is the thing to point at: "it fired there, at 0.74, 260 milliseconds after I
  stopped." A room reads a frozen shape far better than a moving one.
- One key **replays the held trace at quarter speed** while the call sits idle. Never during a turn.

**In the pocket, if the frozen trace is not landing:** raise `eot_threshold` toward 0.9 and
`eot_timeout_ms`. This genuinely slows the agent, so a 3 second turn yields roughly 12 samples
instead of 1, and it is free because those are already toggles. The catch is that they are this
beat's own dials, so you are spending the beat's mechanism on stagecraft. Use it live, not as the
default.

**Also fix:** the threshold marker on the bar is hardcoded at `left: 70%`
(`src/web/public/index.html:78`). It must track the live `eotThreshold` toggle, or the line stands
still while the dial moves.

**Also show the tail.** Published end-of-turn latency is 260ms at P50 but p90 is around 1s and p95
around 1.5s. Put p50, p90 and p95 on screen from the start. On a conference network the tail will
appear at least once, and having it already on screen turns a stumble into the most credible
moment in the talk.

**Fix mechanism:** live parameter change via `Configure`. No reconnect.

---

## What happens when it fails anyway

Every beat needs a recorded MP4 of a clean run in both modes, cut so any single beat can be
dropped in without breaking the narrative. The presenter must be able to switch to video without
apologising. See `PHASES.md` Phase 6.

The app is not responsible for playing the video. Keep that outside the app.


---

## Toggle polarity, and the one dependency

Settled 2026-09-22. Every switch starts off and every switch means "on is better". The presenter
never turns something off to fix it. Keys are `1` barge-in, `2` keyterms, `3` eager EOT,
`4` smart EOT, `5` multilingual, and `R` replays the last turn's trace at quarter speed.

**Settled 2026-09-22: the rambler runs before the false start.** `eagerEot` requires `smartEot`,
because speculation is promoted at `EndOfTurn` and the silence timer never produces one. With the
old order the false start would have had to switch on the rambler's reveal to work at all.

The order is now **barge-in, keyterms, the rambler, the false start**, and the keys were renumbered
to match so they are pressed 1, 2, 3, 4 straight down the rail. Each beat turns on exactly one new
switch, and the demo ends on the tool call that cannot be un-fired, which is the most quotable
thing in the talk and leads straight into the checklist slide.

To undo: swap the two beat sections below, swap the `kbd` values for `smartEot` and `eagerEot` in
`src/web/public/index.html`, and swap rows 3 and 4 of the key table in `README.md`. Nothing in the
code depends on the order.
