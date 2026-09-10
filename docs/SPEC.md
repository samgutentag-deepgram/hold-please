# Build spec

Read `RUN-OF-SHOW.md` first. Every module here exists to serve a beat.

## Shape

One TypeScript process. One HTTP port serving three things:

1. **Vonage webhooks** (`/webhooks/answer`, `/webhooks/event`) returning NCCO
2. **A websocket the Vonage Voice API connects to** for bidirectional call audio
3. **The dashboard**, static HTML plus its own control websocket

The process holds, per call:

- The Vonage audio socket (raw PCM in and out)
- A Deepgram **Flux STT** socket (`/v2/listen`)
- A Deepgram **Flux TTS** socket (`/v2/speak`)
- One LLM client, one provider, no framework
- A toggle state object
- An append-only event log with monotonic timestamps

```
caller ──phone──> Vonage ──ws(pcm)──> [ our process ] ──ws──> Flux STT
                                            │  ▲
                                            │  └── ws ── Flux TTS ──┐
                                            │                        │
                                            ├── LLM (one provider) ──┘
                                            │
                                            └── ws(json events) ──> browser dashboard
```

Audio never touches the browser. The dashboard is a read-only view plus a toggle sender.

## Modules

Keep these as separate files with narrow surfaces, because the toggles need to reach into them
and the events need to come out of them.

| Module | Owns | Notes |
|---|---|---|
| `telephony/vonage.ts` | Webhooks, NCCO, the audio socket | Start from the published Vonage Deepgram voice agent guide |
| `stt/flux.ts` | The `/v2/listen` socket, its state machine, `Configure` sends | Must expose `configure(partial)` that mutates a **live** socket |
| `tts/fluxTts.ts` | The `/v2/speak` socket, `Interrupt` handling | Must surface `text_spoken` as an event |
| `agent/loop.ts` | Turn orchestration, LLM call, speculative execution | Where eager EOT speculation is issued and cancelled |
| `bus/events.ts` | Typed event emit, one monotonic clock | Single source of timestamps. Never mix clocks |
| `toggles/state.ts` | Toggle state, validation, broadcast | Validates the eager <= eot constraint before applying |
| `web/` | Dashboard page and its socket | One page, no build step if avoidable |

## The event contract

Everything the dashboard shows comes from one typed event stream. One monotonic clock,
`performance.now()` based, captured once at process start.

```ts
type DemoEvent =
  | { t: number; kind: 'call.started';      callId: string }
  | { t: number; kind: 'call.ended';        callId: string }
  | { t: number; kind: 'stt.startOfTurn' }
  | { t: number; kind: 'stt.update';        text: string; eotConfidence: number }
  | { t: number; kind: 'stt.eagerEndOfTurn'; text: string }
  | { t: number; kind: 'stt.turnResumed' }
  | { t: number; kind: 'stt.endOfTurn';     text: string; latencyMs: number }
  | { t: number; kind: 'stt.languages';     languages: string[] }
  | { t: number; kind: 'llm.speculativeStart'; turnId: string }
  | { t: number; kind: 'llm.speculativeCancel'; turnId: string }
  | { t: number; kind: 'llm.firstToken';    turnId: string; ttftMs: number }
  | { t: number; kind: 'tts.firstByte';     turnId: string; ttfbMs: number }
  | { t: number; kind: 'tts.interrupt';     textSpoken: string }
  | { t: number; kind: 'socket.degraded';   which: 'stt' | 'tts' | 'vonage'; detail: string }
  | { t: number; kind: 'toggle.changed';    name: string; value: unknown }
  | { t: number; kind: 'config.applied';    reconnected: boolean; fields: string[] }
```

`config.applied` carrying `reconnected: false` is what proves beat 2. Surface it.

## The toggle contract

Toggles are the only way anything changes on stage. All of them apply without a reconnect and
without dropping the call.

| Toggle | Type | Serves | Effect |
|---|---|---|---|
| `naiveMode` | bool | Beats 1, 2, 4 | Bypasses Flux turn detection for a simple silence-based VAD, disables keyterms, disables `Interrupt` handling. This one switch is what makes every failure land, because the room can see it is the same agent |
| `keyterms` | bool | Beat 2 | Sends `Configure` with the keyterm list on the live socket |
| `eagerEot` | bool | Beat 3 | Enables speculative execution |
| `eagerEotThreshold` | number 0.3 to 0.9 | Beat 3 | **Must be <= `eotThreshold`.** UI must block the invalid combination, not let the presenter discover it on stage |
| `eotThreshold` | number 0.5 to 0.9 | Beat 4 | |
| `eotTimeoutMs` | number 500 to 60000 | Beat 4 | |
| `multilingual` | bool | Opener gag | Switches model to `flux-general-multi`. See below |

Toggle state is in memory, broadcast to the dashboard on change, and reflected in the UI
immediately. There is no persistence and no config file.

## The dashboard

One page. No scrolling. Readable at 25% scale in a screenshot. Design for a bad projector at 15
feet and assume nobody in the room opens a laptop.

Four zones, in priority order:

1. **The transcript.** Dominant element, largest type on the page. Live, with interim results
   visibly distinct from finals. Half the impact of every beat is textual.
2. **State pill.** Listening, thinking, speaking, interrupted. Big, one colour per state.
3. **The confidence bar.** `end_of_turn_confidence` climbing, roughly 4Hz. Best-looking thing on
   the page. Serves beat 4 and makes beat 3 legible.
4. **A small honest stats strip.** End-of-turn p50, p90 and p95. Connection uptime, which is what
   proves the no-reconnect claim. Speculative calls issued versus used, for beat 3.

Toggles live in a row that is visible but not prominent. The presenter needs to hit them without
looking; the room does not need to read them.

No charts library. No CSS framework. Inline everything.

## The opener gag: Gutentag triggers German

Sam's surname is Gutentag, which is homophone-adjacent to the German greeting "guten Tag". Running
`flux-general-multi` and putting the live language readout on screen means his own introduction
may flip the language indicator to German, which is a free laugh in the first 30 seconds and, more
usefully, teaches the room that the transcript panel is live and worth watching.

**Build it behind the `multilingual` toggle, and treat it as unproven until tested.** Three honest
caveats:

1. **It may not fire.** Flux may simply transcribe "Gutentag" as an English proper noun. Test
   before anyone plans a joke around it. Do not promise this in a rehearsal note until it has
   fired three times in a row.
2. **It changes the model.** `flux-general-multi` is a different model from `flux-general-en`, and
   turn-detection behaviour may differ. The four beats depend on turn detection, so if the multi
   model degrades any beat, **the beats win and the gag is cut.**
3. **Pricing differs** between the two models. Irrelevant on stage, since pricing never appears
   in the UI, but relevant to whoever holds the key.

Implementation: the `stt.languages` event already exists in the contract, sourced from the
`languages` field on every `TurnInfo`. Render it as a small flag or language code next to the
state pill. That readout is the gag and it is also the pocket beat for a mid-call language switch
if a primary beat ever gets cut.

## Failure behaviour

The demo runs on a network we cannot scout, in front of a camera. Degrade visibly, never crash.

- Deepgram socket drops: emit `socket.degraded`, show a visible banner, attempt reconnect with
  backoff, keep the call up.
- LLM call fails or times out: fall back to a canned line so the agent still speaks. Silence on
  stage reads as a crash even when it is not.
- Vonage socket drops: the call is over. Show it plainly and be ready to redial.
- Never let a stack trace or an unstyled error page reach the projector.

## Explicitly out of scope

- Persistence of any kind
- Authentication on the dashboard, since it runs on localhost
- Multi-call or concurrency. One call at a time is the whole requirement
- A latency waterfall. That was the alternative talk shape and it is not this one
- The two pocket beats, background noise and a volunteer language switch
- Playing the fallback videos. Keep that outside the app
