# Demo script

> **STALE as of 2026-09-22, and being rewritten.** Every line below is written for the old
> fiction, an electric utility called Harbor Light Electric with kilowatt hours and meter reads.
> The demo is now **Bramble Hill Pet Lodge**, a dog boarding and daycare business, picking the
> story up from Liz Acosta's pug rescue demo that runs immediately before ours. The caller adopted
> the pug; now he has to board it. The beat order also changed: barge-in, keyterms, the rambler,
> the false start. The *shape* of every beat still holds. The words do not. Do not rehearse from
> this file until it is rewritten.



The twenty minutes, timed, with what to press, what to say, and what the room should be looking
at. Written to be read from a phone in the wings and to be shot as a video with no audience. Two
cuts: **Talk** is the full slot. **Video** is the same beats at about nine minutes; skip anything
marked *talk only*.

Rehearse against this, then change it to what actually worked. Nothing here is fixed until the
beat has failed on cue ten times in a row.

## Before you walk up

- The call is already up and has been for at least ten minutes. Uptime counter running.
- Dashboard full screen in Chrome, at least 1080p, no other windows. Refresh once. Event log
  disclosure closed.
- Switches: **naive OFF, keyterms ON, eager OFF, multilingual OFF.** Eager 0.50, eot 0.70, timeout 5000.
- Headset on, wired. Agent audio teed to the PA. Say one word and confirm the state pill goes
  green, then let it settle to listening.
- Phone within reach for the video cut. On stage the "phone" is the headset; do not wave a handset
  around, it reads as a prop.
- Slides: one opener, one checklist, one handoff. Nothing else. Slides close after the opener.
- Fallback MP4s open in a second window, one per beat, each cued to its first frame.

## 0:00 to 1:30, the opener *(video: 0:00 to 0:30)*

**Slide 1 up.** Title. Face the room, not the screen.

> Every voice agent demo works. You have seen a hundred of them and they all work. Then a real
> person calls, and they do four things the demo never did. They talk over it. They say a word
> it has never heard. They pause in the middle of a sentence. And they do not stop talking.
>
> I am going to do all four to this one, live, on an open call. Then I am going to fix three of
> them without hanging up.

**Close the slides. Dashboard fills the screen.** Point at the four zones, ten seconds total.

> This is the inside of the agent. What I say, in white. What it says, in blue. The pill is what
> it thinks it is doing. The bar is how sure it is that I have finished talking. The numbers at
> the bottom are real and they are not going to be flattering.

*Stage direction:* do not explain the switches. The room will learn them by watching.

## 1:30 to 5:00, beat 1, barge-in *(video: 0:30 to 2:30)*

**Press 1. Naive mode ON.** The red switch reads ON. Say nothing about it yet.

**You, into the headset:** "Can you explain how time-of-use pricing works?"

*Wait for the agent to get two sentences in.* Blue text is filling. State pill says speaking.

**You, over the top of it:** "Sorry, actually, what's my balance?"

*What happens:* the agent keeps talking. It finishes the paragraph over you. Then, if it heard
your question at all, it answers it as if you had waited politely. The room has done this on a
real call. Let them sit in it for two seconds.

> That is a voice agent that was built the way most of them get built. Silence timer, no
> interrupt. It is not broken. It is exactly what it was told to do.

**Press 1. Naive mode OFF.** Point at the switch as you do it.

> Same agent. Same call. One switch.

**You:** "Can you explain how time-of-use pricing works?" *Two sentences in:* "Sorry, actually,
what's my balance?"

*What happens:* audio cuts on your first syllable. The blue text truncates and a red marker says
"heard up to here." The agent asks for your last name, because that is an account question.
Do not answer yet. Point at the red marker.

> That marker is the whole beat. The agent knows exactly which words I heard before I cut it off,
> not which words it generated. So it does not repeat itself, and it does not answer a question I
> already withdrew. That comes from the speech side, not the language model.

*Fallback cue:* if the audio does not cut, say "that one is on video" and play beat 1 fixed.

## 5:00 to 8:30, beat 2, the name *(video: 2:30 to 5:00)*

You are mid-conversation. The agent is waiting for a last name.

**Press 2. Keyterms OFF.** Do it visibly; you are about to make things worse on purpose.

**You:** "Gutentag."

*What happens:* white line reads **Guten Tag**. The agent: "I heard Guten Tag. Is that right?"

**You:** "Yes."

*What happens:* "I don't have an account under that name. Could you say the last name once more?"

Let the laugh happen. Then, to the room:

> That is my actual name. Every speech model on earth has heard the German greeting ten thousand
> times and my surname never. Yours has a word like this. A product name. A street. A drug. The
> caller says it correctly and gets locked out of their own account.

**Press 2. Keyterms ON.** Now point at two things, in this order: the green line that says
"applied live, no reconnect: keyterms", and the uptime counter, still counting.

> Watch that counter. I did not reconnect. I did not restart anything. I sent one message down the
> socket that is already open and said: this word exists.

**You:** "Gutentag."

*What happens:* white line reads **Gutentag**, one word. "I heard Gutentag. Is that right?"

**You:** "Yes."

*What happens:* "Got it, I have your account. Your balance is 187 dollars and 42 cents, due
October first."

> Keyterm prompting is for vocabulary, not spelling. The model did not learn to spell. It learned
> that a word exists, on a call that was already in progress.

*Fallback cue:* if Flux hears the name correctly with keyterms off, do not fight it. Say "it got me
this time, it does not always" and play beat 2 broken, then continue live from the fix.

## 8:30 to 12:00, beat 3, the false start *(video: 5:00 to 6:30)*

Account is open. **Press 3. Eager ON.** Eager slider at 0.50.

> Now the trade-off nobody talks about. The agent can start thinking before I have finished my
> sentence. That is faster. It is also a bet.

**You, with a full one-second pause at the ellipsis:** "So I was looking at my bill and I noticed
that… the August one was higher than July, is that right?"

*What happens:* on the pause, "speculative issued" ticks to 1 in the stats strip. When you keep
talking it is cancelled. When you actually stop, a second one is issued and this one is used.
The counter reads 2 issued, 1 used. The agent answers: August was 203 dollars and 18 cents,
July 209 dollars and 74 cents, so August was lower, not higher.

Point at the counter.

> Two calls to the language model, one answer. The first one was wasted because I paused. At
> scale that is your LLM bill going up by half to buy about two hundred milliseconds. That is not
> a bug. That is a product decision, and this is the dial for it.

**Drag eager to 0.80.** Repeat the sentence with the same pause.

*What happens:* no speculation on the pause. The agent waits. Reply is a beat slower.

> Same question. Zero wasted calls. Slower. Pick one.

*Talk only:* drag eager back to 0.50 and leave it. *Video:* cut here.

*Fallback cue:* if the pause does not trigger speculation, lengthen it to two seconds. If it still
does not, play beat 3 and move on; this beat is the one the room will forgive.

## 12:00 to 15:00, beat 4, the rambler *(video: 6:30 to 8:30)*

**Press 1. Naive ON.** Red switch.

> Last one. The caller who does not stop talking.

**You, without a clean stop, about 45 seconds:** "So my bill has been kind of all over the place
this year, like July was really high, and I think that was the air conditioning, but then
September came down a bit, and I'm trying to figure out whether I should switch plans, because
someone told me about the time-of-use thing, but I work from home so I'm not sure that…"

*What happens:* the naive agent jumps in at your first breath with an answer to half a question.
Let it. Talk over it if you want; naive mode will not stop.

**Press 1. Naive OFF.** Point at the confidence bar before you start.

> Watch the bar this time.

*Same ramble, same pauses.* The bar sits low through every pause and only climbs when you actually
trail off. The agent waits. When you stop, it answers the whole thing: time-of-use would have
saved about 11 dollars a month on this usage, and working from home cuts into that.

> It is not guessing from silence. It is reading the sentence. That bar is the model's confidence
> that I am done, four times a second, and the threshold it fires at is a product decision too.
> Patient agent, slower. Eager agent, interrupts. This dial.

**Nudge the eot slider to 0.60, then back to 0.70.** Do not re-run; the point is that it is a dial.

*Fallback cue:* if the naive agent does not interrupt you, you paused too cleanly. Ramble worse.

## 15:00 to 17:30, the checklist *(talk only)*

**Slide 2 up.** Four lines, no logos.

> Before your voice agent meets a real caller: Does it stop when they talk? Does it know what
> they heard before it stopped? Does it know the words your callers use that the model does not?
> Does it decide a turn is over by listening, or by a timer? Every one of those failed here in the
> last fifteen minutes, and every fix was one message on an open socket.

## 17:30 to 20:00, the handoff *(talk only)*

**Slide 3 up.** QR to the repo, both startup programs.

> Everything you saw is in this repo, including the switches. Liz is up next and she is going to
> show you the fast way to build one of these. Take the fast way. Then come back to this list.

Hand over. Do not take questions on stage; the slot is twenty minutes and Vonage is behind you.

## Video cut

Nine minutes, no slides, no room. Shoot the dashboard as the only picture, your voice as the only
sound, agent audio from the server tee not the PA. Open with the four-zone walkthrough over the
dashboard at rest, run beats 1 to 4 as above without the talk-only sections, and end on the
checklist read as voice-over on the dashboard, not a slide. One take per beat, cut between beats
on the state pill returning to listening. If a beat does not fail on take three, keep the take
where the fix worked and narrate the failure over the broken half from an earlier recording.

Record every take with the app's recorder on (it is on by default), so the caller audio and the
event log of the good take can be replayed and checked.

## Warm-up questions the account can answer

For soundcheck, or for the room to shout out afterwards. Verified name first.

- "What's my balance?" 187 dollars and 42 cents, due October first.
- "What was it two months ago?" July, 209 dollars and 74 cents.
- "How does this month compare to last September?" 160 dollars and 5 cents then, about 27 dollars
  and 17 percent more now.
- "When is my next meter read?" October 4.
- "Did my last payment go through?" 203 dollars and 18 cents on September 2.
- "Would time-of-use save me money?" About 11 dollars a month.

## Rehearsal notes

Why a name and not a code: on 2026-09-10, three alphanumeric codes (`A7-4K-92-Q`, `R2-B4-U8-Y`,
`C4-U2-I8-B`) all transcribed correctly on the Elgato with keyterms off. Flux does not need help
with letters and digits on a good mic.

Why a name and not a street: two streets were tried first and both lost on Sam's voice, which is
the only voice that matters. Ygnacio Valley Road: the keyterm flipped a synthetic voice from
"Ignacio" to "Ygnacio" but never Sam's. Tuolumne Street: three synthetic voices went "to alumni"
off and "Tuolumne" on, but Sam says it "tuh-LOO-mee" and Flux heard "Talumi" with keyterms off
*and* on, because the keyterm biases toward the place's pronunciation and that is not what was
said. The surname is the one word the presenter says the same way every time, and it was the only
candidate proven both ways on his own voice: "Guten Tag" off, "Gutentag" on.

Proof on a recording: every call writes `recordings/<stamp>-<call>-caller.wav` and an events log.
`AUDIO=recordings/...-caller.wav node --env-file=.env scripts/keyterm-probe.mjs` transcribes the
real audio with keyterms off and on. If the two outputs match, the word is wrong for the voice, not
the toggle. If a live run refuses a correct transcript, check the events log for the `Configure`
line and its `ConfigureSuccess` before blaming the model.

If the phone codec makes codes fail on the real number, the code is still in the account as a
pocket prop. Do not build the beat on it until it has failed ten times in a row on a real call.

## The pocket beat, a language switch

Tested 2026-09-10 with multilingual on: saying "Sam Gutentag" did **not** flip the readout to
German, so the surname gag is unproven at best. Speaking a Spanish sentence did flip it to ES. If
a primary beat is cut, the pocket beat is a sentence of Spanish mid-call, and the chips beside the
state pill are the whole visual.

## The pocket beat, a language switch

Tested 2026-09-10 with multilingual on: saying "Sam Gutentag" did **not** flip the readout to
German, so the surname gag is unproven at best. Speaking a Spanish sentence did flip it to ES. If
a primary beat is cut, the pocket beat is a sentence of Spanish mid-call, and the chips beside the
state pill are the whole visual.

## Beat 3, the false start

Naive mode off. Eager EOT **on**, threshold at 0.5.

- "So I was looking at my bill and I noticed that…" pause for a full second, as if done, then
  "…the August one was higher than July, is that right?"

What the screen shows: a speculative call starts on the pause and is cancelled when you continue.
The counter of speculative calls issued versus used ticks. This is a trade, not a bug: say so.

Then raise the eager threshold to 0.8 and do it again. No speculation on the pause, slightly
slower reply. Then put it back to 0.5 and ask a clean question so the room sees a speculation
that gets used.

## Beat 4, the rambler

Naive mode **on** first, so the silence timer cuts you off.

- Ramble for 45 seconds without a clean stop: "So my bill has been kind of all over the place
  this year, like July was really high, and I think that was the air conditioning, but then
  September came down a bit, and I'm trying to figure out whether I should switch plans, because
  someone told me about the time-of-use thing, but I work from home so I'm not sure that…"

Broken: the agent jumps in at the first pause with an answer to half a question.

Naive mode **off**. Same ramble. Watch the confidence bar sit low through the pauses and only
climb when you actually stop. Then raise `eot_timeout_ms` if it waits too long, or lower
`eot_threshold` if it waits too long on a clear stop, and narrate that these are product
decisions about how patient the agent should be.

