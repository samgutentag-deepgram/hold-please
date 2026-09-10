# Presenter script

What to say into the phone, beat by beat, and what should happen. The account the agent knows is
in `src/agent/account.ts`; the confirmation code is `A7-4K-92-Q`. Nothing here is fixed until it
has failed on cue ten times in rehearsal (Phase 7). Treat this as the first draft to rehearse
against, and update it with what actually works.

## Warm-up, before the slides close

The call is already up. Ask two ordinary questions so the room hears a working agent first.

- "Hi, what's the balance on my account?" The agent asks for the confirmation code. Read it. It
  reads it back, confirms, and gives the balance: 187 dollars and 42 cents, due October first.
- "What was it two months ago?" July: 209 dollars and 74 cents.
- "How does this month compare to the same month last year?" September 2025 was 160 dollars and
  5 cents, so about 27 dollars more, roughly 17 percent, with the rate increase in January and
  more kilowatt hours both contributing.

Other questions the agent can answer from the account:

- "When is my next meter read?" October 4.
- "Did my last payment go through?" 203 dollars and 18 cents on September 2.
- "Would time-of-use save me money?" About 11 dollars a month on this usage.
- "Why was my July bill so high?" Highest usage of the year, 1310 kilowatt hours.

## Beat 1, barge-in

Naive mode **on**.

- "Can you explain how time-of-use pricing works?" The agent starts a five-sentence answer.
- Two sentences in, talk over it: "Sorry, actually, what's my balance?"

Broken: the agent finishes its paragraph over you, then answers the balance question as if you had
waited politely. Or it stops and starts the explanation again from the top.

Naive mode **off**. Same two lines. The audio cuts on your first word, the screen shows the exact
words you heard, and the answer is the balance.

## Beat 2, the confirmation code

Naive mode off. Keyterms **off**. Start a fresh call or ask something that needs the account.

- "What's the balance on my account?" The agent asks for the code.
- Read it plainly at normal speed: "A seven, four K, nine two, Q."

Broken: the transcript shows words. The agent reads back what it heard, says it does not match,
and asks again. Do not correct it.

Flip **keyterms on**. Watch the uptime counter keep ticking and `config.applied` land with no
reconnect. Read the same code the same way. It matches. "Got it, I have your account."

If the code does not fail reliably without keyterms, change the code, not the script. Set
`DEMO_CODE` in `.env` and restart; the keyterm list follows it. On the first live run,
`A7-4K-92-Q` transcribed correctly with keyterms off, so it is probably not the one. Candidates
built from letters and digits that are also words, read at normal speed with no pauses:

- `R2-B4-U8-Y`, which wants to become "are to be for you ate why"
- `C4-U2-I8-B`, "see for you too I ate be"
- `Y2-R4-U0-Q`, "why to are for you oh queue"

Test each five times with keyterms off, then five with keyterms on. Keep the one with the widest
gap. The keyterms are the code's groups (`R2`, `B4`, `U8`, `Y`), which is what the toggle sends.

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

## The checklist slide

Four failures, four fixes, in the order the room just watched. No app needed.

## If a beat will not fail

Cut to the recorded MP4 for that beat, in the same mode, without apologizing. The recordings are
Phase 6. Until they exist, skip the beat and say what it would have shown.
