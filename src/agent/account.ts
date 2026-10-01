// The one file the agent knows. Fictional, and shaped so the presenter has real questions to ask
// as a brand new customer: what the lodge needs before a first visit, what a day looks like,
// which package fits a schedule, and when the first visit can be.
//
// The storyline picks up from Liz Acosta's demo, which runs immediately before ours: her agent
// helps a caller find a pug rescue. Ours is the next call that caller makes. He adopted the pug,
// the rescue forwarded the dog's records to the lodge, and now he is phoning to register him.
// Settled 2026-09-29, replacing the existing-customer account from 2026-09-22.
//
// The surname is the beat 2 prop: the agent needs it to find the rescue's file before it will
// discuss this dog, and Flux hears "Gutentag" as "Guten Tag" until keyterms tell it the name
// exists. Settled 2026-09-10 after two streets lost on the presenter's own voice. The surname is
// the one word the presenter says the same way every time.

export const REGISTRATION = {
  owner: 'Sam Gutentag',
  surname: 'Gutentag',
  petName: 'Otto',
  petBreed: 'pug',
  petAge: 'two years old',
  petWeight: 'nineteen pounds',
  adoptedFrom: 'a pug rescue, earlier this month',
  status: 'records received from the rescue, not yet registered',

  vaccinations: {
    rabies: 'current, good through next August',
    distemper: 'current, good through next June',
    kennelCough: 'not on file. The rescue records show it is due, so he needs the booster before his first visit',
  },
  rescueNotes: 'Friendly with small dogs, a little nervous with big ones. Snores. Loves a tennis ball he cannot actually fit in his mouth.',

  /** Beat 4's sentence is "Thursday... actually, make it Friday", so both days need an answer. */
  openAssessmentSlots: 'Thursday October 1 at two in the afternoon, Friday October 2 at ten in the morning or one in the afternoon',
}

export function renderRegistration(): string {
  const r = REGISTRATION
  return `Owner: ${r.owner}
Surname used to find the file (the caller must say this name before you discuss this dog): ${r.surname}
Dog: ${r.petName}, a ${r.petAge} ${r.petBreed}, ${r.petWeight}, adopted from ${r.adoptedFrom}
Status: ${r.status}
Rabies: ${r.vaccinations.rabies}
Distemper: ${r.vaccinations.distemper}
Kennel cough: ${r.vaccinations.kennelCough}
Notes from the rescue: ${r.rescueNotes}
Open assessment visits this week: ${r.openAssessmentSlots}`
}
