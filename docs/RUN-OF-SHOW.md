# Run of show

20 minutes. This document is the requirements source: every feature in `SPEC.md` exists to serve
a beat below. If a proposed feature does not map to a beat, it does not get built.

| Time | Beat | What the app must do |
|---|---|---|
| 0:00 to 1:30 | **"Every demo works."** One slide, then slides close for good | Warm, with a call already up. Optional: the Gutentag gag, see below |
| 1:30 to 5:00 | **Beat 1, barge-in** | Naive mode on, then off |
| 5:00 to 8:30 | **Beat 2, the confirmation code** | Keyterms pushed mid-call |
| 8:30 to 12:00 | **Beat 3, the false start** | Eager EOT visible, then tuned |
| 12:00 to 15:00 | **Beat 4, the rambler** | EOT params tuned mid-call |
| 15:00 to 17:30 | **The checklist.** One slide, all four failures as a pre-launch checklist | Nothing |
| 17:30 to 20:00 | **Handoff.** QR to the repo, both startup programs | Nothing |

Each beat runs the same four-step shape: **break it, name why, fix it, run it again.** Roughly
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

**Broken (naive mode on):** the agent either keeps talking over the caller, or stops and loses its
place, then repeats itself or answers the wrong question.

**Fixed (naive mode off):** Flux's `StartOfTurn` fires reliably, TTS is cut, and the `Interrupt`
server message on the speak socket carries `text_spoken`, which is exactly what the caller heard
before cutting in. The agent resumes from there instead of from the top.

**What the app must show:** the value of `text_spoken` on screen, large, the moment it arrives.
That single field is the beat. Also a visible state pill moving between listening, thinking and
speaking, so the room can see the barge-in land.

**Fix mechanism:** a toggle. No reconnect.

---

## Beat 2 — The confirmation code

**On stage:** the presenter gives the street name on the account, "Tuolumne Street". (Originally a
confirmation code; changed 2026-09-10 after three alphanumeric codes all transcribed correctly with
keyterms off. Flux handles letters and digits on a good mic; it needs help with words it has not seen.)

**Broken:** the street comes back as different words. "Tuolumne" becomes "to alumni", the agent reads
that back, and cannot find the account.

**Fixed:** the presenter clicks one toggle that sends a `Configure` control message on the **already
open** Flux socket, adding keyterms. Says the same street again. It comes back correct, and the account opens.

**What the app must show:** the transcript before and after, side by side or stacked, so the room
sees the same input produce two different outputs. Also a small visible confirmation that the
socket did not reconnect, because that is the part that is hard to believe. A connection-uptime
counter that keeps ticking through the fix is the cheapest way to prove it.

**Fix mechanism:** `Configure` on the live socket. **This is the centrepiece of the whole talk and
the most demo-valuable capability in the stack. Build this beat first after the spine.**

---

## Beat 3 — The false start

**On stage:** the presenter pauses mid-sentence as if finished, then continues.

**Broken:** nothing is technically broken. `EagerEndOfTurn` fires, a speculative LLM call starts,
and `TurnResumed` cancels it. The point of the beat is that this is a tradeoff with a bill
attached, not a bug.

**What the app must show:** the speculative call starting and being cancelled, as discrete visible
events. Also a running count of speculative calls issued versus used, because the honest number
is the beat. Eager at 0.3 to 0.5 buys 150 to 250ms and costs 50 to 70% more LLM calls.

**Fix mechanism:** adjust `eager_eot_threshold` live and re-run. Note the hard constraint:
`eager_eot_threshold` must be less than or equal to `eot_threshold` or the connection errors out.
**The UI must prevent that combination rather than let the presenter break the demo on stage.**

---

## Beat 4 — The rambler

**On stage:** the presenter talks for around 45 seconds with no clean stopping point.

**Broken:** naive mode either cuts them off after a couple of seconds of silence or waits forever.

**Fixed:** tune `eot_timeout_ms` and `eot_threshold` live, framed as product decisions rather than
config values.

**What the app must show:** the end-of-turn confidence climbing in real time. Every Flux `Update`
event carries `end_of_turn_confidence` roughly four times a second. Render it as a live bar. This
is the best-looking element in the whole demo and it makes "why did it fire there" visible instead
of theoretical.

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
