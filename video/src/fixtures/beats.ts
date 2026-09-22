import type { Cue } from '../components/Caption.tsx'
import type { Side } from '../components/CompareCard.tsx'
import type { ToggleChange } from '../components/ToggleMoment.tsx'
import type { DemoEvent, ToggleName, Toggles } from '../types.ts'
import { byTime, callStartedAgo, updates } from './helpers.ts'

// The four beats, as event timelines.
//
// These are fixtures, not recordings. Every number in them is copied from a verified source:
// the transcripts and the agent's lines come from docs/SCRIPT.md, the latencies from the
// published Flux figures in docs/API-NOTES.md, and the failure shapes from docs/RUN-OF-SHOW.md.
// Nothing here is invented to look good, because the talk is about honest instrumentation and
// a video that fakes its own numbers would be the joke.
//
// When the Vonage number lands and there are real recordings, swap a beat's `events` for
// `fromJsonl(...)` and delete the fixture. That is the whole migration.

export interface BeatSpec {
  id: string
  /**
   * No beat number lives here. A beat's number is its position in the running order, and
   * hardcoding it is how the swap left captions claiming to be beat 3 while playing fourth.
   */
  name: string
  /** The one line that says what real callers do. Shown on the beat's title card. */
  headline: string
  /** One continuous call. The dashboard never remounts, so the uptime counter never resets. */
  events: DemoEvent[]
  /** The switch this beat leaves ON for every beat after it. */
  enables: ToggleName
  /** Already on when this beat's call starts, rather than flipped on camera. Beat 3 only. */
  onAtStart?: boolean
  /** Switches that must already be on for this beat to work at all. */
  requires?: ToggleName[]
  /** Seconds the dashboard is on screen. */
  runS: number
  chips: { at: number; label: string; tone: 'bad' | 'good' | 'neutral' }[]
  cues: Cue[]
  /** When the toggle overlay takes the screen, and for how long. */
  changeAt: number
  changeDurS: number
  change: ToggleChange
  proof: string[]
  compare: { said: string; before: Side; after: Side; footnote: string }
  compareS: number
  titleS: number
}

const TITLE_S = 4
const CHANGE_S = 4.2

// ---------------------------------------------------------------------------------------
// Beat 1 — Barge-in
// ---------------------------------------------------------------------------------------

const TOU_ANSWER =
  'Time-of-use pricing means the rate you pay changes depending on the hour of the day. Peak hours are typically four to nine in the evening on weekdays, when demand is highest.'

export const beat1: BeatSpec = {
  id: 'barge-in',
  name: 'Barge-in',
  headline: 'They talk over it.',
  enables: 'bargeIn',
  runS: 31,
  changeAt: 13,
  changeDurS: CHANGE_S,
  titleS: TITLE_S,
  compareS: 8,
  events: byTime([
    callStartedAgo(252),
    { t: 0, kind: 'agent.state', state: 'listening' },
    { t: 300, kind: 'stt.startOfTurn' },
    ...updates(700, 340, [
      { c: 0.02, text: 'Can you explain how' },
      { c: 0.03, text: 'Can you explain how time of use' },
      { c: 0.05, text: 'Can you explain how time of use pricing works' },
    ]),
    // Naive mode is a silence timer, so the turn ends late and the confidence never mattered.
    { t: 1900, kind: 'stt.endOfTurn', text: 'Can you explain how time-of-use pricing works?', latencyMs: 1204 },
    { t: 1950, kind: 'agent.state', state: 'thinking' },
    { t: 2300, kind: 'llm.firstToken', turnId: 'b1-a', ttftMs: 341 },
    { t: 2500, kind: 'agent.state', state: 'speaking' },
    { t: 2600, kind: 'agent.reply', turnId: 'b1-a', text: TOU_ANSWER },
    { t: 2750, kind: 'tts.firstByte', turnId: 'b1-a', ttfbMs: 148 },

    // The caller cuts in. Nothing happens: no Interrupt, no state change, the agent talks on.
    { t: 5200, kind: 'stt.startOfTurn' },
    ...updates(5600, 420, [
      { c: 0.03, text: 'Sorry actually' },
      { c: 0.06, text: 'Sorry actually what is my balance' },
    ]),
    { t: 7300, kind: 'stt.endOfTurn', text: 'Sorry, actually, what’s my balance?', latencyMs: 1211 },
    { t: 9600, kind: 'agent.state', state: 'thinking' },
    { t: 10100, kind: 'llm.firstToken', turnId: 'b1-b', ttftMs: 352 },
    { t: 10300, kind: 'agent.state', state: 'speaking' },
    // It answers the question the caller already withdrew.
    { t: 10400, kind: 'agent.reply', turnId: 'b1-b', text: 'Peak hours run four to nine PM on weekdays. Would you like me to repeat the off-peak rates?' },
    { t: 10540, kind: 'tts.firstByte', turnId: 'b1-b', ttfbMs: 151 },
    { t: 12400, kind: 'agent.state', state: 'listening' },

    // Lands on the frame the overlay's switch actually moves, so the dashboard and the
    // close-up agree. changeAt + the overlay's own 1.1s lead-in.
    { t: 14150, kind: 'toggle.changed', name: 'bargeIn', value: true },
    { t: 14250, kind: 'config.applied', reconnected: false, fields: ['bargeIn'] },

    { t: 17600, kind: 'agent.state', state: 'listening' },
    { t: 18000, kind: 'stt.startOfTurn' },
    ...updates(18300, 270, [
      { c: 0.03, text: 'Can you explain how' },
      { c: 0.09, text: 'Can you explain how time of use pricing' },
      { c: 0.31, text: 'Can you explain how time of use pricing works' },
    ]),
    { t: 19100, kind: 'stt.endOfTurn', text: 'Can you explain how time-of-use pricing works?', latencyMs: 264 },
    { t: 19200, kind: 'agent.state', state: 'thinking' },
    { t: 19450, kind: 'llm.firstToken', turnId: 'b1-c', ttftMs: 251 },
    { t: 19600, kind: 'agent.state', state: 'speaking' },
    { t: 19700, kind: 'agent.reply', turnId: 'b1-c', text: TOU_ANSWER },
    { t: 19840, kind: 'tts.firstByte', turnId: 'b1-c', ttfbMs: 139 },

    // Same barge-in, one switch later. Audio cuts, and text_spoken says what was heard.
    { t: 22100, kind: 'stt.startOfTurn' },
    { t: 22150, kind: 'agent.state', state: 'interrupted' },
    {
      t: 22200,
      kind: 'tts.interrupt',
      textSpoken:
        'Time-of-use pricing means the rate you pay changes depending on the hour of the day. Peak hours are',
    },
    ...updates(22600, 300, [
      { c: 0.04, text: 'Sorry actually' },
      { c: 0.22, text: 'Sorry actually what is my balance' },
    ]),
    { t: 23400, kind: 'agent.state', state: 'listening' },
    { t: 23500, kind: 'stt.endOfTurn', text: 'Sorry, actually, what’s my balance?', latencyMs: 258 },
    { t: 25600, kind: 'agent.state', state: 'thinking' },
    { t: 25840, kind: 'llm.firstToken', turnId: 'b1-d', ttftMs: 244 },
    { t: 26000, kind: 'agent.state', state: 'speaking' },
    { t: 26100, kind: 'agent.reply', turnId: 'b1-d', text: 'Happy to check that. Can I get the last name on the account?' },
    { t: 26240, kind: 'tts.firstByte', turnId: 'b1-d', ttfbMs: 132 },
    { t: 28500, kind: 'agent.state', state: 'listening' },
  ]),
  chips: [
    { at: 0, label: 'BROKEN', tone: 'bad' },
    { at: 14.2, label: 'FIXED', tone: 'good' },
  ],
  cues: [
    { at: 0, kicker: 'broken', tone: 'bad', text: 'No interrupt handling. This is the default, and it is how most voice agents actually ship.' },
    { at: 5.2, text: 'The caller cuts in. Watch the state pill: it never leaves SPEAKING.' },
    { at: 9.0, text: 'The agent finishes its paragraph over the caller, then answers the question they already withdrew.' },
    { at: 13, kicker: 'the fix', tone: 'good', text: 'Switch barge-in on. No code edit, no hang-up, no reconnect.' },
    { at: 17.4, kicker: 'fixed', tone: 'good', text: 'Same agent, same call, same sentence.' },
    { at: 22.2, text: 'Audio cuts on the first syllable, and text_spoken says exactly what the caller heard.' },
    { at: 26.2, text: 'So it resumes from there instead of from the top, and answers the question that survived.' },
  ],
  change: { kind: 'switch', label: 'barge-in', keyCap: '1', from: false, to: true },
  proof: ['applied live', 'reconnects 0', 'socket never closed'],
  compare: {
    said: 'Sorry, actually, what’s my balance?',
    before: {
      label: 'Barge-in OFF',
      text: 'Finishes the paragraph, then answers the question you withdrew.',
      note: 'No Interrupt message, so the agent has no idea it was cut off. The caller is talking to a recording.',
    },
    after: {
      label: 'Barge-in ON',
      text: '“…Peak hours are”  ⟵ heard up to here',
      note: 'text_spoken is what the caller heard, not what the agent generated. That distinction is the whole beat.',
    },
    footnote: 'It came from the speech layer, not the language model.',
  },
}

// ---------------------------------------------------------------------------------------
// Beat 2 — The confirmation code, which became the surname
// ---------------------------------------------------------------------------------------

export const beat2: BeatSpec = {
  id: 'keyterms',
  name: 'The name',
  headline: 'They say a word it has never heard.',
  enables: 'keyterms',
  runS: 23,
  changeAt: 9,
  changeDurS: CHANGE_S,
  titleS: TITLE_S,
  compareS: 8,
  events: byTime([
    callStartedAgo(285),
    { t: 0, kind: 'agent.state', state: 'listening' },
    { t: 400, kind: 'stt.startOfTurn' },
    ...updates(900, 340, [
      { c: 0.08, text: 'Guten' },
      { c: 0.41, text: 'Guten Tag' },
    ]),
    { t: 1600, kind: 'stt.endOfTurn', text: 'Guten Tag', latencyMs: 271 },
    { t: 1700, kind: 'agent.state', state: 'thinking' },
    { t: 1950, kind: 'llm.firstToken', turnId: 'b2-a', ttftMs: 238 },
    { t: 2100, kind: 'agent.state', state: 'speaking' },
    { t: 2200, kind: 'agent.reply', turnId: 'b2-a', text: 'I heard Guten Tag. Is that right?' },
    { t: 2330, kind: 'tts.firstByte', turnId: 'b2-a', ttfbMs: 141 },
    { t: 4000, kind: 'agent.state', state: 'listening' },
    { t: 4200, kind: 'stt.startOfTurn' },
    ...updates(4600, 300, [{ c: 0.55, text: 'Yes' }]),
    { t: 4900, kind: 'stt.endOfTurn', text: 'Yes.', latencyMs: 262 },
    { t: 5000, kind: 'agent.state', state: 'thinking' },
    { t: 5250, kind: 'llm.firstToken', turnId: 'b2-b', ttftMs: 229 },
    { t: 5400, kind: 'agent.state', state: 'speaking' },
    { t: 5500, kind: 'agent.reply', turnId: 'b2-b', text: 'I don’t have an account under that name. Could you say the last name once more?' },
    { t: 5640, kind: 'tts.firstByte', turnId: 'b2-b', ttfbMs: 136 },
    { t: 7600, kind: 'agent.state', state: 'listening' },

    // One Configure message on the socket that is already open.
    { t: 10150, kind: 'toggle.changed', name: 'keyterms', value: true },
    { t: 10250, kind: 'config.applied', reconnected: false, fields: ['keyterms'] },

    { t: 13600, kind: 'agent.state', state: 'listening' },
    { t: 13900, kind: 'stt.startOfTurn' },
    ...updates(14300, 350, [
      { c: 0.09, text: 'Gutentag' },
      { c: 0.44, text: 'Gutentag' },
    ]),
    { t: 15000, kind: 'stt.endOfTurn', text: 'Gutentag', latencyMs: 266 },
    { t: 15100, kind: 'agent.state', state: 'thinking' },
    { t: 15340, kind: 'llm.firstToken', turnId: 'b2-c', ttftMs: 231 },
    { t: 15500, kind: 'agent.state', state: 'speaking' },
    { t: 15600, kind: 'agent.reply', turnId: 'b2-c', text: 'I heard Gutentag. Is that right?' },
    { t: 15730, kind: 'tts.firstByte', turnId: 'b2-c', ttfbMs: 134 },
    { t: 17400, kind: 'agent.state', state: 'listening' },
    { t: 17600, kind: 'stt.startOfTurn' },
    ...updates(18000, 300, [{ c: 0.58, text: 'Yes' }]),
    { t: 18300, kind: 'stt.endOfTurn', text: 'Yes.', latencyMs: 259 },
    { t: 18400, kind: 'agent.state', state: 'thinking' },
    { t: 18630, kind: 'llm.firstToken', turnId: 'b2-d', ttftMs: 226 },
    { t: 18800, kind: 'agent.state', state: 'speaking' },
    { t: 18900, kind: 'agent.reply', turnId: 'b2-d', text: 'Got it, I have your account. Your balance is 187 dollars and 42 cents, due October first.' },
    { t: 19030, kind: 'tts.firstByte', turnId: 'b2-d', ttfbMs: 133 },
    { t: 21000, kind: 'agent.state', state: 'listening' },
  ]),
  chips: [
    { at: 0, label: 'KEYTERMS OFF', tone: 'bad' },
    { at: 10.2, label: 'KEYTERMS ON', tone: 'good' },
  ],
  cues: [
    { at: 0, kicker: 'broken', tone: 'bad', text: 'The agent wants a last name. The last name is Gutentag.' },
    { at: 1.7, text: 'Every speech model has heard the German greeting ten thousand times, and this surname never.' },
    { at: 5.6, text: 'The caller says their own name correctly and gets locked out of their own account.' },
    { at: 9, kicker: 'the fix', tone: 'good', text: 'One Configure message, sent down the socket that is already open.' },
    { at: 13.4, kicker: 'fixed', tone: 'good', text: 'Watch the uptime counter. It does not reset, because nothing reconnected.' },
    { at: 15.2, text: 'One word now. Keyterm prompting is for vocabulary, not spelling: the model did not learn to spell it, it learned the word exists.' },
    { at: 19, text: 'Account opens. Mid-call, on the same socket, with the caller still on the line.' },
  ],
  change: { kind: 'switch', label: 'keyterms', keyCap: '2', from: false, to: true },
  proof: ['applied live', 'reconnects 0', 'uptime still climbing'],
  compare: {
    said: 'Gutentag',
    before: { label: 'Keyterms OFF', text: 'Guten Tag', note: 'Two words. A German greeting. No account under that name.' },
    after: { label: 'Keyterms ON', text: 'Gutentag', note: 'One word. Balance, due date, done.' },
    footnote: 'Your callers have a word like this. A product name, a street, a drug, a surname.',
  },
}

// ---------------------------------------------------------------------------------------
// Beat 3 — The false start. The tradeoff, not a fix.
// ---------------------------------------------------------------------------------------

const BILL_Q =
  'So I was looking at my bill and I noticed that… the August one was higher than July, is that right?'
const BILL_A =
  'August was 203 dollars and 18 cents, and July was 209 dollars and 74 cents, so August was actually lower, not higher.'

export const beat3: BeatSpec = {
  id: 'eager-eot',
  name: 'The false start',
  headline: 'They pause in the middle of a sentence.',
  // Eager is already on when the call starts: this beat's on-camera change is the dial, not
  // the switch. And eager cannot be on at all unless smart EOT is, which is the whole reason
  // the beat order is under review.
  enables: 'eagerEot',
  onAtStart: true,
  requires: ['smartEot'],
  runS: 22,
  changeAt: 9,
  changeDurS: CHANGE_S,
  titleS: TITLE_S,
  compareS: 9,
  events: byTime([
    callStartedAgo(318),
    { t: 0, kind: 'agent.state', state: 'listening' },
    { t: 400, kind: 'stt.startOfTurn' },
    ...updates(800, 500, [
      { c: 0.05, text: 'So I was looking at my bill' },
      { c: 0.28, text: 'So I was looking at my bill and I noticed that' },
      { c: 0.56 },
    ]),
    // Confidence crosses 0.50, so Flux calls an eager end of turn and the agent starts thinking.
    { t: 1850, kind: 'stt.eagerEndOfTurn', text: 'So I was looking at my bill and I noticed that' },
    { t: 1900, kind: 'llm.speculativeStart', turnId: 'b3-spec-1' },
    { t: 2600, kind: 'stt.turnResumed' },
    { t: 2650, kind: 'llm.speculativeCancel', turnId: 'b3-spec-1' },
    ...updates(2700, 480, [
      { c: 0.11, text: 'So I was looking at my bill and I noticed that the August one' },
      { c: 0.33, text: 'So I was looking at my bill and I noticed that the August one was higher than July' },
      { c: 0.81, text: 'So I was looking at my bill and I noticed that the August one was higher than July is that right' },
    ]),
    { t: 3750, kind: 'stt.eagerEndOfTurn', text: BILL_Q },
    { t: 3800, kind: 'llm.speculativeStart', turnId: 'b3-spec-2' },
    { t: 3950, kind: 'stt.endOfTurn', text: BILL_Q, latencyMs: 262 },
    { t: 4000, kind: 'agent.state', state: 'thinking' },
    { t: 4150, kind: 'llm.firstToken', turnId: 'b3-spec-2', ttftMs: 96 },
    { t: 4300, kind: 'agent.state', state: 'speaking' },
    { t: 4400, kind: 'agent.reply', turnId: 'b3-spec-2', text: BILL_A },
    { t: 4530, kind: 'tts.firstByte', turnId: 'b3-spec-2', ttfbMs: 131 },
    { t: 7000, kind: 'agent.state', state: 'listening' },

    { t: 10150, kind: 'toggle.changed', name: 'eagerEotThreshold', value: 0.8 },
    { t: 10250, kind: 'config.applied', reconnected: false, fields: ['eager_eot_threshold'] },

    { t: 13600, kind: 'agent.state', state: 'listening' },
    { t: 13900, kind: 'stt.startOfTurn' },
    ...updates(14300, 500, [
      { c: 0.06, text: 'So I was looking at my bill' },
      { c: 0.31, text: 'So I was looking at my bill and I noticed that' },
      // Same pause, same 0.58. Under 0.80, so nothing speculative is issued this time.
      { c: 0.58 },
      { c: 0.12, text: 'So I was looking at my bill and I noticed that the August one' },
      { c: 0.49, text: 'So I was looking at my bill and I noticed that the August one was higher than July' },
      { c: 0.84, text: 'So I was looking at my bill and I noticed that the August one was higher than July is that right' },
    ]),
    { t: 16850, kind: 'stt.eagerEndOfTurn', text: BILL_Q },
    { t: 16900, kind: 'llm.speculativeStart', turnId: 'b3-spec-3' },
    { t: 17000, kind: 'stt.endOfTurn', text: BILL_Q, latencyMs: 268 },
    { t: 17100, kind: 'agent.state', state: 'thinking' },
    { t: 17380, kind: 'llm.firstToken', turnId: 'b3-spec-3', ttftMs: 287 },
    { t: 17500, kind: 'agent.state', state: 'speaking' },
    { t: 17600, kind: 'agent.reply', turnId: 'b3-spec-3', text: BILL_A },
    { t: 17730, kind: 'tts.firstByte', turnId: 'b3-spec-3', ttfbMs: 137 },
    { t: 19800, kind: 'agent.state', state: 'listening' },
  ]),
  chips: [
    { at: 0, label: 'EAGER 0.50', tone: 'neutral' },
    { at: 10.2, label: 'EAGER 0.80', tone: 'neutral' },
  ],
  cues: [
    { at: 0, kicker: 'the tradeoff, not a fix', text: 'Nothing is broken here. Eager end-of-turn lets the agent start thinking before the caller finishes.' },
    { at: 1.9, text: 'The caller pauses mid-sentence. Speculative issued ticks to 1.' },
    { at: 2.7, text: 'They keep talking, so that call is cancelled. You already paid for it.' },
    { at: 4.2, text: 'Two calls to the model, one answer. Bought about 200 ms, cost an extra inference nobody heard.' },
    { at: 9, kicker: 'the dial', text: 'This is not a repair. It is a product decision with a slider attached.' },
    { at: 13.4, kicker: 'Eager at 0.80', text: 'Same sentence, same pause. Nothing speculative fires.' },
    { at: 17.4, text: 'Zero waste. A beat slower — first token 287 ms instead of 96. Pick one.' },
  ],
  change: {
    kind: 'dial',
    label: 'eager EOT threshold',
    from: 0.5,
    to: 0.8,
    min: 0.3,
    max: 0.9,
    format: (v) => v.toFixed(2),
  },
  proof: ['applied live', 'eager ≤ eot, enforced in the UI'],
  compare: {
    said: 'So I was looking at my bill and I noticed that… the August one was higher than July',
    before: { label: 'Eager 0.50', text: '2 issued, 1 used', note: 'One wasted inference per false start. At scale that is 50 to 70% more LLM calls for about 200 ms.' },
    after: { label: 'Eager 0.80', text: '1 issued, 1 used', note: 'Zero waste, and a slower first token. Neither column is the right answer.' },
    footnote:
      'The real bill is side effects. A speculative turn that calls a tool dispatches it immediately: it can charge a card before the turn resumes and the reply is thrown away. Set defer_until_eot on anything you cannot take back.',
  },
}

// ---------------------------------------------------------------------------------------
// Beat 4 — The rambler
// ---------------------------------------------------------------------------------------

const RAMBLE_FULL =
  'So my bill has been kind of all over the place this year, like July was really high, and I think that was the air conditioning, but then September came down a bit, and I’m trying to figure out whether I should switch plans, because someone told me about the time-of-use thing, but I work from home so I’m not sure that…'

export const beat4: BeatSpec = {
  id: 'rambler',
  name: 'The rambler',
  headline: 'They do not stop talking.',
  enables: 'smartEot',
  runS: 32,
  changeAt: 11.5,
  changeDurS: CHANGE_S,
  titleS: TITLE_S,
  compareS: 9,
  events: byTime([
    callStartedAgo(372),
    { t: 0, kind: 'agent.state', state: 'listening' },
    { t: 400, kind: 'stt.startOfTurn' },
    ...updates(900, 700, [
      { c: 0.03, text: 'So my bill has been kind of all over the place this year' },
      { c: 0.02, text: 'So my bill has been kind of all over the place this year, like July was really high' },
      { c: 0.01, text: 'So my bill has been kind of all over the place this year, like July was really high, and I think that was the air conditioning,' },
    ]),
    // A silence timer cannot tell a breath from a sentence, so it fires on the first one.
    { t: 3200, kind: 'stt.endOfTurn', text: 'So my bill has been kind of all over the place this year, like July was really high, and I think that was the air conditioning,', latencyMs: 1204 },
    { t: 3300, kind: 'agent.state', state: 'thinking' },
    { t: 3650, kind: 'llm.firstToken', turnId: 'b4-a', ttftMs: 342 },
    { t: 3850, kind: 'agent.state', state: 'speaking' },
    { t: 3950, kind: 'agent.reply', turnId: 'b4-a', text: 'Air conditioning is usually the biggest summer driver. Would you like me to compare July to June?' },
    { t: 4090, kind: 'tts.firstByte', turnId: 'b4-a', ttfbMs: 152 },
    { t: 5200, kind: 'stt.startOfTurn' },
    ...updates(5700, 700, [
      { c: 0.02, text: 'but then September came down a bit' },
      { c: 0.02, text: 'but then September came down a bit, and I’m trying to figure out whether I should switch plans' },
    ]),
    { t: 7600, kind: 'stt.endOfTurn', text: 'but then September came down a bit, and I’m trying to figure out whether I should switch plans,', latencyMs: 1198 },
    { t: 7700, kind: 'agent.state', state: 'thinking' },
    { t: 8050, kind: 'llm.firstToken', turnId: 'b4-b', ttftMs: 338 },
    { t: 8250, kind: 'agent.state', state: 'speaking' },
    { t: 8350, kind: 'agent.reply', turnId: 'b4-b', text: 'I can help with plans. Which plan are you on today?' },
    { t: 8490, kind: 'tts.firstByte', turnId: 'b4-b', ttfbMs: 149 },
    { t: 10400, kind: 'agent.state', state: 'listening' },

    { t: 12650, kind: 'toggle.changed', name: 'smartEot', value: true },
    { t: 12750, kind: 'config.applied', reconnected: false, fields: ['smartEot'] },

    { t: 16100, kind: 'agent.state', state: 'listening' },
    { t: 16400, kind: 'stt.startOfTurn' },
    // 23 samples at the real report rate. The trace is the argument, so it has to be honest
    // about how many points there are: low through every breath, climbing only at the end.
    ...updates(16650, 260, [
      { c: 0.02, text: 'So my bill has been kind of' },
      { c: 0.04, text: 'So my bill has been kind of all over the place this year' },
      { c: 0.09 },
      { c: 0.18 },
      { c: 0.34, text: 'So my bill has been kind of all over the place this year, like July was really high' },
      { c: 0.12 },
      { c: 0.06, text: 'So my bill has been kind of all over the place this year, like July was really high, and I think that was the air conditioning' },
      { c: 0.03 },
      { c: 0.11 },
      { c: 0.27, text: '…but then September came down a bit' },
      { c: 0.41 },
      { c: 0.16 },
      { c: 0.08, text: '…and I’m trying to figure out whether I should switch plans' },
      { c: 0.05 },
      { c: 0.13 },
      { c: 0.29, text: '…because someone told me about the time-of-use thing' },
      { c: 0.19 },
      { c: 0.07 },
      { c: 0.15, text: '…but I work from home so I’m not sure that' },
      { c: 0.38 },
      { c: 0.52 },
      { c: 0.63 },
      { c: 0.78 },
    ]),
    { t: 22600, kind: 'stt.endOfTurn', text: RAMBLE_FULL, latencyMs: 276 },
    { t: 22700, kind: 'agent.state', state: 'thinking' },
    { t: 23050, kind: 'llm.firstToken', turnId: 'b4-c', ttftMs: 298 },
    { t: 23200, kind: 'agent.state', state: 'speaking' },
    { t: 23300, kind: 'agent.reply', turnId: 'b4-c', text: 'On this usage, time-of-use would save about 11 dollars a month — though working from home cuts into that, since you would be drawing power during peak hours.' },
    { t: 23440, kind: 'tts.firstByte', turnId: 'b4-c', ttfbMs: 138 },
    { t: 25800, kind: 'agent.state', state: 'listening' },

    // The marker on the bar and the dashed line on the frozen trace both track this dial.
    { t: 27200, kind: 'toggle.changed', name: 'eotThreshold', value: 0.6 },
    { t: 27300, kind: 'config.applied', reconnected: false, fields: ['eot_threshold'] },
    { t: 29400, kind: 'toggle.changed', name: 'eotThreshold', value: 0.7 },
    { t: 29500, kind: 'config.applied', reconnected: false, fields: ['eot_threshold'] },
  ]),
  chips: [
    { at: 0, label: 'BROKEN', tone: 'bad' },
    { at: 12.7, label: 'FIXED', tone: 'good' },
  ],
  cues: [
    { at: 0, kicker: 'broken', tone: 'bad', text: 'A caller with no clean stopping point, and an agent ending turns on a 1200 ms silence timer.' },
    { at: 3.3, text: 'It heard a breath and called it a sentence. First interruption, three seconds in.' },
    { at: 8.3, text: 'Second one. It is now answering half a question it was never asked.' },
    { at: 11.5, kicker: 'the fix', tone: 'good', text: 'Switch smart EOT on and let the model decide. Same call, same socket.' },
    { at: 16, kicker: 'fixed', tone: 'good', text: 'Watch the confidence bar instead of the transcript.' },
    { at: 19, text: 'It stays under the line through every pause. It is reading the sentence, not timing the silence.' },
    { at: 22.7, text: 'Crossed at 0.78 and fired 276 ms after the caller actually trailed off. 23 samples, frozen so the room can read it.' },
    { at: 27.2, text: 'Where that line sits is a product decision too. Patient agent, slower. Eager agent, interrupts. This dial.' },
  ],
  change: { kind: 'switch', label: 'smart EOT', keyCap: '3', from: false, to: true },
  proof: ['applied live', 'reconnects 0', 'socket never closed'],
  compare: {
    said: '…I’m trying to figure out whether I should switch plans, because someone told me about the time-of-use thing, but I work from home so I’m not sure that…',
    before: { label: 'Smart EOT OFF', text: 'Cut off twice in forty-five seconds', note: 'A 1200 ms silence timer cannot tell a breath from a sentence, so it guesses, and it guesses early.' },
    after: { label: 'Smart EOT ON', text: 'Waited. Answered the whole thing.', note: '23 confidence samples, under the line through every pause, crossing only at the end.' },
    footnote: 'Every fix in the last four beats was one message on a socket that never closed.',
  },
}

// ---------------------------------------------------------------------------------------
// Ordering
// ---------------------------------------------------------------------------------------

/**
 * The running order, settled 2026-09-22 after watching both cuts.
 *
 * Barge-in, keyterms, the rambler, the false start. Each beat turns on exactly one new
 * switch and the keys get pressed 1, 2, 3, 4 straight down the rail. The order is forced
 * rather than chosen: `eagerEot` is refused unless `smartEot` is already on, so the false
 * start cannot precede the rambler without borrowing the rambler's own reveal. Ending on
 * the false start also ends the talk on the tool call that cannot be un-fired.
 */
export const ORDER: BeatSpec[] = [beat1, beat2, beat4, beat3]

/**
 * What is already switched on when a beat's call begins, derived from the beats before it.
 *
 * No beat carries hardcoded initial toggles, because the whole point of the contract is that
 * switches only ever go on, and that makes a beat's starting state a function of the running
 * order rather than a property of the beat.
 */
export function carryIn(order: BeatSpec[], index: number): Partial<Toggles> {
  const on: Partial<Toggles> = {}
  for (let i = 0; i <= index; i++) {
    const spec = order[i]
    for (const name of spec.requires ?? []) on[name] = true as never
    if (i < index || spec.onAtStart) on[spec.enables] = true as never
  }
  return on
}

export const BEATS = ORDER
