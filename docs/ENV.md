# Environment and local dev

## Credentials needed

| What | Status as of 2026-09-10 | Notes |
|---|---|---|
| Vonage Voice API number | **NOT PROVISIONED. Top blocker** | A trial account cannot rent a number and cannot accept calls from anyone but the account holder. Needs a comped or upgraded developer account |
| Vonage API key and secret | Not provisioned | Comes with the account above |
| Vonage application private key | Not provisioned | Voice API auth is JWT signed with an application private key, not the API secret |
| Deepgram API key with **Flux TTS** entitlement | Unconfirmed | Flux TTS shipped 2026-08-12, so an older key may only carry Aura. Confirm the entitlement specifically. The free build tier ended 2026-09-12, so confirm the key still works in October rather than only during the free window |
| LLM provider key | Not provisioned | One provider. Keep it boring |

## Env vars

```
PORT=3000
PUBLIC_URL=                  # ngrok or similar, Vonage webhooks must reach it

VONAGE_APPLICATION_ID=
VONAGE_PRIVATE_KEY_PATH=
VONAGE_NUMBER=

DEEPGRAM_API_KEY=
DEEPGRAM_STT_MODEL=flux-general-en
DEEPGRAM_TTS_VOICE=

LLM_PROVIDER=
LLM_API_KEY=
LLM_MODEL=
```

Never commit a key. `.env` is gitignored; verify that before the first commit that adds one.

## The local harness, so Phase 1 is not blocked

Phase 1 needs audio in and audio out. It does not strictly need a phone. Build a `--local` mode
that swaps the Vonage audio socket for microphone in and speaker out on the dev machine, keeping
everything downstream identical.

This is worth the hour it costs. It unblocks phases 1 through 5 while the Vonage account is
outstanding, and it stays useful afterwards as the fast iteration loop, since dialling a phone
number forty times to test a toggle is not a loop anyone sustains.

The one thing local mode cannot prove is the telephony leg itself: codec, jitter, and the way real
phone audio degrades turn detection. Reserve real calls for verifying beats, not for developing
them.

## Webhook exposure

Vonage needs to reach `/webhooks/answer` and `/webhooks/event` from the public internet. Use ngrok
or equivalent in development. The URL changes on restart unless you have a reserved domain, and a
stale URL in the Vonage application config presents as a call that rings and dies with no logs,
which is a confusing ten minutes if you have not seen it before.

## Verifying the Deepgram key quickly

Before wiring anything, confirm the key reaches Flux TTS rather than only Aura. The playground and
`talk.deepgram.com` are the fastest checks. A key that silently falls back to an older voice model
will waste an afternoon.
