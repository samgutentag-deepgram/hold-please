# API notes

Verified against primary sources on 2026-08-18 and re-verified 2026-09-10 while writing Phase 1.
**Re-verify before touching integration code again**,
because Flux TTS shipped 2026-08-12 and the stack has been moving. Check
`developers.deepgram.com`, not blog posts. The docs have been correct; the blogs have been stale.

## Traps that will cost you an hour each

1. **The Flux launch blog has stale parameter names.** `eot_silence_threshold_ms` does not exist.
   Use `eot_timeout_ms`. Do not copy code from blog posts.
2. **`eager_eot_threshold` must be less than or equal to `eot_threshold`** or the connection
   errors out. Validate in the toggle layer, before the socket sees it.
3. **Keyterm prompting works on Flux** on both `flux-general-en` and `flux-general-multi`, and is
   **updatable mid-stream via the `Configure` control message with no reconnect**. Beat 2 depends
   entirely on this. If you find yourself reconnecting to apply keyterms, you have taken a wrong
   turn.
   Verified 2026-09-10 against docs/flux/configure: the message is
   `{"type":"Configure","keyterms":[...],"thresholds":{"eot_threshold":...,"eot_timeout_ms":...,"eager_eot_threshold":...}}`,
   the server answers `ConfigureSuccess` or `ConfigureFailure`, **the keyterms list is replaced, not
   merged**, an omitted field keeps its value, and an empty array clears. Up to 100 terms, no
   weight syntax.
4. **End-of-turn is 260ms at P50 but p90 is around 1s and p95 around 1.5s.** Design the UI to show
   the tail rather than just the median.

## Flux STT

- Model `flux-general-en`, or `flux-general-multi` for the multilingual path
- State machine events: `StartOfTurn`, `Update`, `EagerEndOfTurn`, `TurnResumed`, `EndOfTurn`
- Every `StartOfTurn` is guaranteed non-empty, which makes it more reliable for barge-in than an
  external VAD
- Every `Update` carries `end_of_turn_confidence`, arriving roughly 4 times per second
- `TurnInfo` carries a `languages` field, which is the source for the language readout
- Parameters: `eot_timeout_ms` (500 to 60000, default 5000), `eot_threshold` (0.5 to 1.0, default
  0.7), `eager_eot_threshold` (0.3 to 0.9). Auth is `Authorization: Token <key>`. Audio is binary
  frames; 16 kHz linear16 is the recommended input
- `EndOfTurn` carries `trigger`: `model`, `timeout`, or `manual`. Worth showing on the beat 4 bar
- Eager tradeoff: 0.3 to 0.5 saves 150 to 250ms and costs 50 to 70% more LLM calls

Docs: [configuration](https://developers.deepgram.com/docs/flux/configuration) ·
[state](https://developers.deepgram.com/docs/flux/state) ·
[feature overview](https://developers.deepgram.com/docs/flux/feature-overview) ·
[eager EOT](https://developers.deepgram.com/docs/flux/voice-agent-eager-eot) ·
[agent guide](https://developers.deepgram.com/docs/flux/agent)

## Flux TTS

- Endpoint `/v2/speak`
- **Barge-in is a round trip.** We send `Interrupt`; the server answers with **`SpeechInterrupted`**,
  which carries `text_spoken`, exactly what the caller heard before cutting in. This single field is
  beat 1. (Corrected 2026-09-10: earlier notes called the server message `Interrupt`. It is not.)
- **`text_spoken` is only present if our `Interrupt` carried `playback_offset`**, in milliseconds from
  the start of the *session's* audio, and each offset must advance past the previous one. Without it
  the server cannot compute the split. `src/audio/playback.ts` tracks that number; do not reset it
  per turn
- Stop the audio locally first, then send `Interrupt`. Frames that arrive between the two were
  already on the wire; discard them until `SpeechInterrupted` lands
- The server closes an idle socket after 60 s (`NET-0004`). Send a websocket ping to keep it open
- Text is sent as `Speak` messages, any chunk size, and `Flush` ends the turn. The server does not
  insert whitespace between `Speak` chunks, so LLM tokens can go straight through
- First audio as low as 80ms, and stays under 200ms **regardless of response length**, because it
  interleaves text and audio generation
- Handles alphanumerics, account numbers, dates and currency correctly, which is the second half
  of beat 2

Docs: [Flux TTS overview](https://developers.deepgram.com/docs/flux-tts/overview)

## Audio and barge-in

Read [audio preprocessing and barge-in](https://developers.deepgram.com/docs/guides/deep-dives/audio-preprocessing-barge-in)
before building. Echo cancellation and noise suppression on a room mic **actively degrade** turn
detection.

The architecture already answers this and it is not negotiable: **caller audio comes in over a
wired headset, and the agent's reply is teed from the server into the house PA.** The room never
touches the demo audio in either direction. Test the mute-while-speaking guard and test for PA
bleed into the headset mic.

## Vonage Voice API

Start from the published guide:
[AI Voice Agent with Deepgram](https://developer.vonage.com/en/voice/voice-api/guides/voice-ai-agent-deepgram).

What it gives you: inbound handling via the `/answer` webhook, NCCO with talk and connect actions,
bidirectional websocket audio streaming, call event webhooks, and barge-in via a CLEAR control
message.

What it omits, and what we therefore write ourselves: tool calls, fallbacks when a tool fails,
agent loop limits, and any transcript persistence. We need none of those except the fallbacks.

**Credential reality:** a Vonage trial account **cannot rent a virtual number** and **voice calls
only work to the account holder's own registered number**. Both facts are fatal to this demo,
which needs inbound calls from an audience member's phone. See
[trial account limitations](https://api.support.vonage.com/hc/en-us/articles/212554438-What-are-the-limitations-of-a-trial-account).
A comped or upgraded developer account is required.

## Never cite

- The Nova-3 "54.2% WER reduction" figure. Internal Feb 2025 benchmark, unvalidated externally,
  and it predates Flux, which matches rather than beats Nova-3 on WER
- Any pricing, anywhere in the UI or on a slide
