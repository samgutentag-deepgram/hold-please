# AGENTS.md

Coding sessions start at `docs/README.md` and follow its read order. It is self-contained.

`CLAUDE.md` is a pointer to this file. The planning repo that holds the strategy and the event
context is private and is not needed to write code.

Runtime: Node 24 runs the TypeScript directly, no bundler and no build step. Local imports carry a
`.ts` extension and the code stays inside the erasable subset TypeScript enforces with
`erasableSyntaxOnly`. `npm run dev` starts the one process. `npm run check` typechecks and tests.

Dependencies are deliberate and few: `ws` (websocket server; the clients use it too), and
`@anthropic-ai/sdk` for the one LLM. Everything else is `node:` built-ins. Do not add Express, a
bundler, a component library, or the Deepgram SDK; the sockets are raw on purpose so every event
can be instrumented and broken on stage. Constructor parameter properties are not erasable syntax,
so declare fields and assign them in the body.

## Tracking, and the other session

**Asana is the only progress tracker.** Board: "Vonage Tech Week talk",
https://app.asana.com/1/411927538413705/project/1217634344062073
Do not create a to-do list, question list, or status table in this repo. The planning repo deleted
two of those on 2026-09-10 for drifting.

Two sessions work on this and both read and write the board. A Cowork session holds the email,
Slack, calendar and partner context; this repo's coding session holds the code. Split by lane, not
by tool:

- **This session writes** task state whose evidence is in this repo: build tasks, phase status, the
  dashboard, rehearsal, API notes. Close them, comment on them, cite the commit or file that proves
  it.
- **This session does not write** anything involving people, email, dates, partners or logistics.
  Leave those to the Cowork session even when the board looks wrong.
- **Every write cites its evidence** in the comment, so a disagreement is visible instead of silent.

Read the board before reporting status, and prefer it over your own memory of what was done.

The planning repo is `../vonage-demo`, private, not needed to write code. It holds the strategy, the
event context and `.hub/ledger.md`, the append-only record of *why*. When a decision here changes
the talk rather than the code, append an entry there. That ledger is how the other session learns
what happened in this repo.
