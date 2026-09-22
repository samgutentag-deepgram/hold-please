# Live coding on stage

**Status: proposed, not built. Sam revisits this next session.**

Hard constraint 2 has said "no live coding on stage" since the first spec, and the entire toggle
architecture exists to satisfy it. That constraint is now under review, for a good reason rather
than a whim.

## Why it changed

Liz Acosta, presenting immediately before us, said in the shared channel on 2026-09-22:

> we'll have a mic stand, some sort of hands free mic option right? (i think we'll both be doing
> a little coding and we'll need our hands!)

So she is live coding, and she assumes we are too. If she types and we only press number keys,
the second half of a paired session looks less technical than the first, in a room that came to
watch people build things. That is a real reason to revisit, and it is worth more than the
tidiness of the original constraint.

## The thing that will kill it if nobody notices

**`npm run dev` runs `node --watch`. Saving a source file restarts the process. A restart tears
down the Vonage websocket and the call drops.**

Hard constraint 3 is that three of the four fixes apply to a socket that stays open, and it is
described in this repo as the single most important technical requirement in the whole build. The
uptime counter ticking through a fix is the proof, and it is the part of beat 2 the room finds
hardest to believe.

So the naive version of this idea, open `src/agent/loop.ts` on the projector and comment out a
line, **destroys the talk's central claim in the act of demonstrating it.** Anyone implementing
this without reading this paragraph will find out on stage.

## The shape that works

Edit a file the running process *reads*, not a file it *imports*.

1. A small `live/demo.config.json`, or a `.js` module read with `fs.readFile` rather than
   `import`, holding the same values the toggles hold.
2. The process watches it with `fs.watch`, debounced. It is **not** on the `--watch` path, so
   nothing restarts. Run with `npm start` rather than `npm run dev` on stage.
3. On change: parse, run it through the existing `validateToggle`, and push it through
   `ToggleStore.set()`. That path already fans out to `stt.configure()` on the live socket and
   already emits `config.applied { reconnected: false }`.

Nothing new is needed downstream. The toggle store, the validation, the no-reconnect proof and
the dashboard banner all already exist; this is a second input into the same door.

**It is better theatre than the toggles, not merely equivalent.** The room watches a line of code
change and watches the socket survive it. A keypress proves less because a keypress looks like an
app feature. A file save looks like the thing they do all day.

## What it costs, and what to watch

- **A syntax error on stage applies nothing.** The watcher must catch parse and validation errors
  and surface them on the dashboard as a visible, non-fatal banner. It must never take the process
  down. This is the single most important detail after the restart problem.
- **Two windows.** The working agreement says one process and one window. An editor beside the
  dashboard breaks that, and the editor needs enormous type to be legible at 15 feet. The
  dashboard is the thing that must stay readable; the editor can be a narrow strip.
- **Seconds.** Every beat competes for time in 20 minutes. Commenting out a pre-written line is
  fast. Typing a new one is not. Nothing gets typed from scratch.
- **The toggles do not go away.** They stay as the fallback for every beat. If an edit does not
  take, press the key and keep moving. Never debug a file on stage.

## Where to try it first

**Beat 4, the false start, editing the eager threshold.** Changing a number is the safest possible
live edit, it is unambiguously code, and beat 4 is about a dial, so editing a value is the honest
representation of what is happening. If it lands, consider promoting it.

**Not beat 2 first.** Beat 2 is the centrepiece and the hardest thing in the talk to get right.
It is the beat that benefits most from a live edit and also the one where a fumble costs most.
Earn it on beat 4 and then decide.

## Open questions for the next session

1. One beat as a live edit, or all four? A single one is a change of pace; four is a different
   talk and a different rehearsal burden.
2. Does the editor share the projector with the dashboard, or is there a second output?
3. Does `demo.config` mirror every toggle, or only the values a beat actually edits? Mirroring
   everything means two sources of truth for the same state and they will drift on stage.
4. Does Liz want to coordinate on this, given she raised it? A paired session where both
   presenters edit code is a stronger shared story than each doing it separately.
