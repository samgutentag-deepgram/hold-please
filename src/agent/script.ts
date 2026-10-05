import type { Toggles } from '../toggles/state.ts'

// The happy path through the talk, as the agent's memory should look once each step is done. The
// dashboard's rail draws these steps; the loop tags each caller line with the step it completes,
// so the rail shows where the conversation really is, and Z moves it back exactly one step when
// the line it removes was one. Shift-click on the rail seeks: the agent's memory is replaced by the
// canned exchange up to that step, and the switches are set to what that point of the talk expects.

export interface ScriptStep {
  beat: string
  label: string
  /** Lowercased fragments; a caller line completes the step when it contains any of them. */
  match: string[]
  /** The canned exchange a seek writes into memory for this step. */
  caller: string
  agent: string
}

export const SCRIPT: ScriptStep[] = [
  {
    beat: 'opener', label: 'I just adopted a dog',
    match: ['adopt', 'new dog', 'a vet'],
    caller: 'Hi, I just adopted a dog, and he needs a vet.',
    agent: "That's wonderful, congratulations! What's his name?",
  },
  {
    beat: 'opener', label: 'His name is Otto',
    match: ['otto', 'auto', 'name is', "name's"],
    caller: 'His name is Otto.',
    agent: 'Hello Otto! How can I help with him?',
  },
  {
    beat: 'beat1', label: 'First wellness exam?',
    match: ['wellness', 'exam', 'first visit'],
    caller: 'What happens at his first wellness exam?',
    agent: 'At his first wellness exam the vet does a nose to tail check, looking at his weight, heart and lungs, eyes, ears, teeth',
  },
  {
    beat: 'beat1', label: 'Can we just sign him up?',
    match: ['sign', 'new patient', 'register'],
    caller: 'Sorry, actually, can we just get him signed up as a new patient?',
    agent: "Of course. I've passed that to the front desk, and they'll text you to confirm today. Is there anything else I can help with?",
  },
  {
    beat: 'beat2', label: 'Can he see Dr. Gutentag?',
    match: ['see dr', 'see doctor', 'doctor', 'dr.', 'dr '],
    caller: 'Can he see Dr. Guten Tag?',
    agent: "I don't see a Doctor Guten Tag at our clinic. Could you say the vet's name once more?",
  },
  {
    beat: 'beat2', label: 'Dr. Gutentag',
    match: ['guten', 'tag', 'doctor', 'dr'],
    caller: 'Dr. Gutentag.',
    // Spoken when jumping to beat 3, so the ramble answers a scheduling question.
    agent: 'Yes, Doctor Gutentag is seeing new patients. He has Thursday at two in the afternoon, or Friday at ten in the morning or one in the afternoon. What works for you?',
  },
  {
    beat: 'beat3', label: 'The ramble',
    match: ['office', 'tuesday', 'thursday', 'work from home', 'most days', 'later in the week'],
    caller: "So, I work from home most days, but on Tuesdays, and, um, Thursdays, I'm in the office. What do you have later in the week?",
    // Short on purpose: a jump to beat 4 speaks this line as the question the caller answers.
    agent: 'Later in the week, Doctor Gutentag has Friday at ten in the morning or one in the afternoon. Which works for you?',
  },
  {
    beat: 'beat4', label: 'Friday at ten… make it one',
    match: ['friday', 'make it one'],
    caller: 'Can I bring him in Friday at ten, actually, make it one.',
    agent: "You'd like to bring Otto in on Friday at one in the afternoon. I've passed that to the front desk, and they'll text you to confirm the time today. Is there anything else I can help with?",
  },
  {
    beat: 'beat5', label: '¿Algún veterinario habla español?',
    match: ['español', 'espanol', 'spanish', 'habla', 'veterinario'],
    caller: '¿Tienen algún veterinario que hable español?',
    agent: "Yes, Doctor Okafor speaks Spanish. I've passed that to the front desk, and they'll text you to set it up. Is there anything else I can help with?",
  },
]

export const BEATS: { id: string; title: string; key?: string }[] = [
  { id: 'opener', title: 'Opener' },
  { id: 'beat1', title: 'Beat 1 · barge-in', key: '1' },
  { id: 'beat2', title: 'Beat 2 · keyterms', key: '2' },
  { id: 'beat3', title: 'Beat 3 · smart EOT', key: '3' },
  { id: 'beat4', title: 'Beat 4 · eager EOT', key: '4' },
  { id: 'beat5', title: 'Bonus · multilingual', key: '5' },
]

/** The switches the talk expects when the presenter is about to say step `i`. Each beat starts
 *  broken (its own switch off) with every earlier beat's switch on; the second line of a two-line
 *  beat is the fixed run, so its switch is on. */
export function togglesForStep(i: number): Partial<Toggles> {
  const at = (id: string) => SCRIPT.findIndex((s) => s.beat === id)
  return {
    bargeIn: i > at('beat1'),
    keyterms: i > at('beat2'),
    smartEot: i > at('beat3'),
    eagerEot: false,
    multilingual: i > at('beat5'),
  }
}

/** Which step a caller line completes, given the steps already done, or null when it is off
 *  script. Only the next step, or the one after it, can match, so a stray word late in the talk
 *  cannot tick an early step. */
export function matchStep(text: string, done: ReadonlySet<number>): number | null {
  const lower = text.toLowerCase()
  const next = SCRIPT.findIndex((_, i) => !done.has(i))
  if (next < 0) return null
  for (const i of [next, next + 1]) {
    const step = SCRIPT[i]
    if (step && !done.has(i) && step.match.some((m) => lower.includes(m))) return i
  }
  return null
}
