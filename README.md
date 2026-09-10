# Your Demo Works. Your Callers Don't.

**This demo shows the same voice agent break on real callers and get fixed mid-call, without a
reconnect.**

A live phone call comes in on a Vonage number. A voice agent answers, listening with Deepgram Flux
and speaking with Flux TTS. On stage it gets broken four times, in the ways every voice agent breaks
once real people call it, and fixed live on the open socket. A browser dashboard shows what is
happening in type you can read from the back of the room.

Built for the Vonage x Deepgram Voice AI Developer Meetup at a16z Tech Week, October 2026, and
presented twice: San Francisco on Tuesday October 6 and Los Angeles on Thursday October 15.

## The four beats

| Beat | You do | What breaks | The fix, applied to the open socket |
|---|---|---|---|
| Barge-in | Talk over the agent | It keeps talking, or restarts from the top | Flux TTS `Interrupt` reports `text_spoken`, and the agent resumes from there |
| The street name | Say "Tuolumne Street" | It comes back as "To Alumni Street" and the account will not open | A `Configure` message adds keyterms mid-stream |
| The false start | Pause mid-sentence, then continue | A speculative LLM call is issued and thrown away | Tune `eager_eot_threshold` and watch the issued-versus-used count |
| The rambler | Talk for 45 seconds | The agent cuts you off, or waits forever | Tune `eot_threshold` and `eot_timeout_ms` while the confidence bar climbs |

Every fix is a toggle in the dashboard. Nothing on stage is a code edit or a restart.

## How it works

One TypeScript process, one port. It serves the Vonage webhooks, holds the Vonage audio socket, the
Flux STT socket and the Flux TTS socket, calls one LLM, and streams a typed event log to the
dashboard over a websocket. Audio never touches the browser.

```
caller ──phone──> Vonage ──ws(pcm)──> [ this process ] ──ws──> Flux STT
                                            │  ▲
                                            │  └── ws ── Flux TTS ──┐
                                            ├── LLM (one provider) ──┘
                                            └── ws(json events) ──> browser dashboard
```

Every event carries a timestamp from one monotonic clock, so the numbers on screen can be trusted
and subtracted.

## Run it

Node 24 or newer and pnpm. There is no build step; Node runs the TypeScript directly.

```bash
pnpm install
cp sample.env .env      # fill in keys as you get them; the dashboard boots without any
npm run dev             # dashboard at http://127.0.0.1:3000
npm run check           # typecheck and tests
```

Runtime dependencies are `ws`, `@anthropic-ai/sdk`, and, for `--local` only, `ffmpeg` on the path.
Vonage needs to reach the webhooks from the public internet, so run something like ngrok and put
its URL in `PUBLIC_URL`. `docs/ENV.md` has the full list and a local mic-and-speaker mode for
developing without a phone.

## Probes

Two scripts under `scripts/` answer "does Flux do X" without a microphone, by synthesizing a phrase
with Flux TTS and streaming it back into Flux STT:

```bash
node --env-file=.env scripts/keyterm-probe.mjs "I live on Ygnacio Valley Road."   # keyterms off vs on
node --env-file=.env scripts/multi-probe.mjs "Guten Tag, my name is Sam."          # what flux-general-multi reports
```

## Status

Phase 1 of 7 is built and waiting on credentials to be exercised. The spine exists: audio in from
Vonage or the local microphone, Flux STT, one LLM turn, Flux TTS out, barge-in with `text_spoken`.
`docs/PHASES.md` has each phase with an exit criterion you can demonstrate, and `docs/README.md`
has the read order for everything else.

Develop without a phone:

```bash
npm run dev -- --local      # microphone in, speakers out, everything else identical
```

## Docs

| File | What it holds |
|---|---|
| `docs/README.md` | Orientation, decisions already made, hard constraints |
| `docs/RUN-OF-SHOW.md` | The 20 minutes, beat by beat |
| `docs/SPEC.md` | Architecture, modules, the event contract, the toggle contract |
| `docs/API-NOTES.md` | Verified Deepgram and Vonage facts, and the traps |
| `docs/PHASES.md` | Build phases with exit criteria |
| `docs/ENV.md` | Credentials, env vars, local dev |

## License

MIT. See `LICENSE`.
