# AGENTS.md

Coding sessions start at `docs/README.md` and follow its read order. It is self-contained.

`CLAUDE.md` is a pointer to this file. The planning repo that holds the strategy and the event
context is private and is not needed to write code.

Runtime: Node 24 runs the TypeScript directly, no bundler and no build step. Local imports carry a
`.ts` extension and the code stays inside the erasable subset TypeScript enforces with
`erasableSyntaxOnly`. `npm run dev` starts the one process. `npm run check` typechecks and tests.
