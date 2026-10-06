import { DEFAULT_TOGGLES, type ToggleName } from './state.ts'

// The code card each switch pops up on the dashboard when it turns on. Replaces live coding:
// the room sees the change as a diff, and the socket never restarts because nothing was edited.
//
// These are teaching diffs, not excerpts. The real code is spread across a class and carries
// error handling nobody can read at 15 feet, so each card is the smallest honest statement of
// what the switch changes, and `ref` names where the real thing lives. The tests check every
// `ref` still resolves, so a refactor that moves the code breaks the build instead of the talk.
//
// Budget: see CARD_LIMITS at the bottom.

export type DiffOp = ' ' | '+' | '-'
export interface CardLine {
  op: DiffOp
  text: string
}
export interface CodeCard {
  title: string
  /** One line, said out loud or read off the card: what the caller gets now. */
  gist: string
  /** When the room wants this switch on, and when off. Short enough to read from the back row. */
  when: { on: string; off: string }
  lines: CardLine[]
  /** Where the real implementation lives. `find` must appear in `file` verbatim. */
  ref: { file: string; find: string }
}

export type CardName = Extract<ToggleName, 'bargeIn' | 'keyterms' | 'smartEot' | 'eagerEot' | 'multilingual'>

const l = (op: DiffOp, text: string): CardLine => ({ op, text })

export function codeCards(keyterms: readonly string[]): Record<CardName, CodeCard> {
  const eager = DEFAULT_TOGGLES.eagerEotThreshold.toFixed(1)
  return {
    bargeIn: {
      title: 'Barge-in',
      gist: 'Stop talking, and remember only what they heard.',
      when: {
        on: 'Almost always.',
        off: 'A read-back of his appointment that must be heard in full.',
      },
      lines: [
        l(' ', '// the caller starts talking'),
        l(' ', "stt.on('StartOfTurn', () => {"),
        l('+', '  if (state !== \'speaking\') return'),
        l('+', '  audio.clear()             // silence, now'),
        l('+', '  llm.abort()               // stop writing'),
        l('+', "  tts.send({ type: 'Interrupt',"),
        l('+', '    playback_offset: playback.playedMs() })'),
        l(' ', '})'),
        l(' ', ''),
        l(' ', '// Flux TTS says how far the caller got'),
        l('+', "tts.on('SpeechInterrupted', (m) => {"),
        l('+', '  history.at(-1).content = m.text_spoken'),
        l('+', '})'),
      ],
      ref: { file: 'src/agent/loop.ts', find: 'private bargeIn(): void' },
    },
    keyterms: {
      title: 'Keyterms',
      gist: 'Teach it the words, on the call that is already open.',
      when: {
        on: 'You know the words are coming: the vets, when booking.',
        off: 'Words for another step. Swap the list when the step changes.',
      },
      lines: [
        l(' ', '// the socket has been open all along'),
        l(' ', 'stt.send({'),
        l(' ', "  type: 'Configure',"),
        l('-', '  keyterms: [],'),
        l('+', '  keyterms: ['),
        ...keyterms.slice(0, 6).map((term) => l('+', `    ${JSON.stringify(term).replaceAll('"', "'")},`)),
        l('+', '  ],'),
        l(' ', '})'),
        l(' ', ''),
        l(' ', "// Flux answers 'ConfigureSuccess'."),
        l(' ', '// Same call. No reconnect.'),
      ],
      ref: { file: 'src/stt/flux.ts', find: "message['keyterms'] = next.keyterms" },
    },
    smartEot: {
      title: 'End of turn',
      gist: 'A pause is not the end of a sentence. Let the model decide.',
      when: {
        on: 'Nearly always. Turn it up for "describe what is wrong".',
        off: 'Almost never. Turn it down, not off, for a quick yes.',
      },
      lines: [
        l(' ', '// before: any pause ends the turn'),
        l('-', 'let timer'),
        l('-', "stt.on('Update', (turn) => {"),
        l('-', '  clearTimeout(timer)'),
        l('-', '  timer = setTimeout(() =>'),
        l('-', '    respond(turn.transcript), 1000)'),
        l('-', '})'),
        l(' ', ''),
        l(' ', '// after: Flux decides the turn is over'),
        l('+', "stt.on('EndOfTurn', (turn) =>"),
        l('+', '  respond(turn.transcript))'),
      ],
      ref: { file: 'src/agent/loop.ts', find: 'private armNaiveTimer(): void' },
    },
    eagerEot: {
      title: 'Eager end of turn',
      gist: 'Start thinking before they finish. Throw it away if they keep going.',
      when: {
        on: 'Offering times and reading them back: just words.',
        off: 'The confirm step: booking, charging, sending.',
      },
      lines: [
        l(' ', 'stt.send({'),
        l(' ', "  type: 'Configure',"),
        l('+', `  thresholds: { eager_eot_threshold: ${eager} },`),
        l(' ', '})'),
        l(' ', ''),
        l('+', "stt.on('EagerEndOfTurn', (turn) =>"),
        l('+', '  draft = llm.start(turn.transcript))'),
        l('+', "stt.on('TurnResumed', () =>"),
        l('+', '  draft.cancel())            // they kept going'),
        l(' ', "stt.on('EndOfTurn', (turn) =>"),
        l('-', '  respond(turn.transcript))'),
        l('+', '  respond(turn.transcript, draft))'),
      ],
      ref: { file: 'src/agent/loop.ts', find: "case 'EagerEndOfTurn':" },
    },
    multilingual: {
      title: 'Multilingual',
      gist: 'One model for every language. The one switch that reconnects.',
      when: {
        on: 'A caller who switches language mid-call.',
        off: 'English-only lines. It reconnects, so flip it between turns.',
      },
      lines: [
        l(' ', "const url = new URL(DEEPGRAM + '/v2/listen')"),
        l('-', "url.searchParams.set('model', 'flux-general-en')"),
        l('+', "url.searchParams.set('model', 'flux-general-multi')"),
        l('+', "url.searchParams.append('language_hint', 'en')"),
        l('+', "url.searchParams.append('language_hint', 'es')"),
        l(' ', "url.searchParams.set('encoding', 'linear16')"),
        l(' ', "url.searchParams.set('sample_rate', '8000')"),
        l(' ', ''),
        l(' ', '// the model is fixed per connection, so'),
        l('+', 'await stt.close()'),
        l('+', 'stt = new FluxStt({ url })'),
        l('+', 'await stt.connect()'),
      ],
      ref: { file: 'src/call.ts', find: "'flux-general-multi'" },
    },
  }
}

// The dashboard scales the code to fill the card, so the budget is about what still reads once
// it is scaled down to fit, not about a fixed font size. Fewer than six lines looks like a toy.
// The when line sits in large type above the code, so each half stays to one line on the card.
export const CARD_LIMITS = { minLines: 6, lines: 16, chars: 56, whenChars: 62 } as const
