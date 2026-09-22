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

## Tracking

Progress is tracked outside this repo. Do not create a to-do list, question list, or status table
here; `docs/PHASES.md` is the only durable statement of where the build stands, and its exit
criteria are the definition of done.
