# Your Demo Works. Your Callers Don't.

**This demo shows the same voice agent break on real callers and get fixed mid-call, without a
reconnect.**

A phone call comes in on a Vonage number. A voice agent answers, listening with Deepgram Flux and
speaking with Flux TTS. On stage it gets broken four times, in the ways every voice agent breaks
once real people call it, and three of those are fixed live on the open socket. A browser
dashboard shows what is happening in type you can read from the back of the room.

Built for the Vonage x Deepgram Voice AI Developer Meetup at a16z Tech Week, October 2026.

## The four beats

| Beat | You do | What breaks | What fixes it, on the open socket |
|---|---|---|---|
| Barge-in | Talk over the agent | It keeps talking, or restarts from the top | Flux TTS `Interrupt` reports `text_spoken`, so the agent resumes from what you actually heard |
| The name on the account | Say "Gutentag" | It comes back as "Guten Tag" and the account will not open | A `Configure` message adds keyterms mid-stream |
| The false start | Pause mid-sentence, then continue | Nothing. This one is the trade, not a fix | Tune `eager_eot_threshold` and read the issued-versus-used count |
| The rambler | Talk for 45 seconds | It cuts you off, or waits forever | Tune `eot_threshold` and `eot_timeout_ms` while the confidence trace fills |

Three fixes and one trade. Beat 3 is the trade: nothing is broken, you are buying 150 to 250 ms of
latency for 50 to 70 percent more model calls, and the interesting cost is that a speculative turn
can fire a tool call that no rollback un-fires.

Every change is a toggle in the dashboard. Nothing is a code edit or a restart.

## Why the raw sockets

Deepgram's [Voice Agent API](https://developers.deepgram.com/docs/voice-agent) is the right default
for almost everything, and it is what you should reach for first. It runs the whole loop for you
over one websocket, and it can retune keyterms and end-of-turn thresholds mid-call with
`UpdateListen`, so "you cannot fix a managed agent live" is not true.

This repo deliberately does it the hard way, holding three sockets and its own turn loop, for one
reason: **the managed API does not emit `EagerEndOfTurn`, `TurnResumed` or per-turn
`end_of_turn_confidence`.** You can fix a managed agent live, but you cannot watch it think. Two of
the four beats are pictures of it thinking, so they only exist down here.

If you want the managed version, it is about 590 lines of Python and it is
[Vonage's demo](https://github.com/Vonage-Community/demo-voice-agent-deepgram-python).

## Quickstart, no phone required

You need **Node 24+**, **ffmpeg** on your path, a **Deepgram API key** and an **Anthropic API key**.
No Vonage account, no ngrok, no phone number.

```bash
git clone https://github.com/samgutentag-deepgram/hold-please.git
cd hold-please
pnpm install                 # npm install also works
cp sample.env .env
```

Put two values in `.env`:

```
DEEPGRAM_API_KEY=...
ANTHROPIC_API_KEY=...
```

Then:

```bash
npm run dev -- --local       # microphone in, speakers out
```

Open <http://127.0.0.1:3000> and talk. Everything downstream of the audio leg is identical to the
phone path, so every beat works here.

### If you hear nothing, or it will not start

Two device settings, two different device lists, and they do not share numbering. This is the
most common way a first run fails.

**Microphone**, `LOCAL_MIC_DEVICE`, avfoundation syntax. `none:default` for the system default, or
`:0` for audio input index 0:

```bash
ffmpeg -f avfoundation -list_devices true -i ""
```

**Speaker**, `LOCAL_SPEAKER_DEVICE`, a CoreAudio index. **`-1` is the system default and is what
you want unless you have a reason.** The list mixes inputs and outputs, so picking an input index
gives you `AudioQueueStart (-66637)` and no sound:

```bash
ffmpeg -f lavfi -i anullsrc -t 0.01 -f audiotoolbox -list_devices true -
```

Indices move when you plug things in, which is why `-1` is the safe default. A dead speaker no
longer stops the run: you get a degraded banner and everything else keeps working, so you can
still watch the transcript and the toggles.

Use headphones, or set `LOCAL_MUTE_WHILE_SPEAKING=1`, or the agent hears itself.

The dashboard boots with no keys at all, so if something is wrong you will see the page before you
see an error.

## Driving the dashboard

| Key | Does |
|---|---|
| `1` | barge-in. Off, the agent talks over you and never learns what you heard. On, it cuts and reports `text_spoken` |
| `2` | keyterms, pushed to the open socket |
| `3` | eager end of turn |
| `4` | smart end of turn. Off, a dumb 1200 ms silence timer decides you are done. On, Flux decides |
| `5` | multilingual model. The only toggle that reconnects, and it says so |
| `R` | replay the last turn's confidence trace at quarter speed |

Every switch starts off and every switch means "on is better". You never turn something off to
fix it. `3` needs `4` on first, because a speculative turn is promoted at end of turn and the
silence timer never produces one.

The eager, eot and timeout sliders apply live. The UI will not let eager exceed eot, because Flux
drops the connection if it does.

## On a real phone

Add Vonage. The flow is the standard Voice API websocket one: Vonage `GET`s `/answer`, this server
returns an NCCO that plays a short greeting and connects the call audio to `/socket`.

1. Create a [Vonage application](https://dashboard.nexmo.com/applications) with **Voice** enabled,
   generate the keypair, and save `private.key` somewhere outside the repo.
2. Rent a voice-capable number and link it to the application.
3. Start a tunnel: `ngrok http 3000`.
4. Point the application's webhooks at it. Answer URL `https://<tunnel>/answer` (GET), Event URL
   `https://<tunnel>/event` (POST).
5. Fill in the rest of `.env`:

```
PUBLIC_URL=https://<tunnel>
VONAGE_APPLICATION_ID=...
VONAGE_PRIVATE_KEY_PATH=/path/to/private.key
VONAGE_NUMBER=...
```

```bash
npm run dev                  # no --local
```

Call the number.

### A note on sample rate

`AUDIO_SAMPLE_RATE` defaults to **8000**, because PSTN is natively 8 kHz and that is what the demo
runs on. One constant in `src/audio/leg.ts` drives the frame size, the NCCO content type, both
Deepgram socket URLs, the playback clock and the recorder. `16000` is supported for studio-mic
work, but a speech-recognition result measured at 16 kHz does not transfer to a phone line, which
is a lesson this repo learned the expensive way.

## How it works

One TypeScript process, one port. It serves the Vonage webhooks, holds the Vonage audio socket, the
Flux STT socket and the Flux TTS socket, calls one LLM, and streams a typed event log to the
dashboard over a websocket. Audio never touches the browser.

```
phone ──▶ Vonage ──▶ /socket ──┬──▶ Flux STT      ──▶ turn events
                               │         │
                               │         ▼
                               │     one LLM call
                               │         │
                               │         ▼
                               └◀── Flux TTS      ──▶ Interrupt, text_spoken
                                         │
                                         ▼
                                  typed event bus ──▶ /ws/dashboard ──▶ browser
```

Every event carries a timestamp from a single monotonic clock. There is no build step: Node runs
the TypeScript directly via type stripping, so the code stays inside the erasable subset and local
imports carry a `.ts` extension.

## Commands

```bash
npm run dev          # start, watching for changes
npm run dev -- --local
npm start            # start, no watch
npm run typecheck
npm test
npm run check        # typecheck and test
```

Those are all of them. There is no build, no lint step, and no bundler.

## Probes

Two scripts answer "does Flux do X" without a microphone, by synthesizing a phrase with Flux TTS
and streaming it back into Flux STT:

```bash
node --env-file=.env scripts/keyterm-probe.mjs "I live on Ygnacio Valley Road."
node --env-file=.env scripts/multi-probe.mjs "Guten Tag, my name is Sam."
```

## Status

Phases 0 to 4 of 7 are built and 25 tests pass. The spine runs end to end against the local
harness: audio in, Flux STT with live `Configure`, one LLM turn, Flux TTS out, barge-in with
`text_spoken`, seven live toggles, and the four-zone dashboard.

Not done yet, and honest about it:

- It has never answered a real phone call. Vonage credentials are the last blocker.
- Beats 1, 3 and 4 have never been run end to end on a call.
- Beat 2's keyterm result was measured at 16 kHz on a studio mic and is **not yet revalidated at
  8 kHz**, which is the rate a phone actually delivers.
- Phase 2's exit criterion, every event in the union observed at least once, is not met.

`docs/PHASES.md` has each phase with an exit criterion you can demonstrate rather than assert.

## Docs

| File | What it holds |
|---|---|
| `docs/README.md` | Orientation, decisions already made, hard constraints |
| `docs/RUN-OF-SHOW.md` | The 20 minutes, beat by beat. The requirements source |
| `docs/SPEC.md` | Architecture, modules, the event contract, the toggle contract |
| `docs/API-NOTES.md` | Verified Deepgram and Vonage facts, and the traps |
| `docs/PHASES.md` | Build phases with exit criteria |
| `docs/ENV.md` | Every environment variable |
| `docs/SCRIPT.md` | What the presenter says, beat by beat |

## License

MIT. See `LICENSE`.
