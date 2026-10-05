// What the clinic knows, which is nothing about this caller. Fictional, and shaped so the presenter
// has real questions to ask as a brand new client of a vet: what happens at a first wellness exam,
// whether the microchip hurts, whether it can all happen in one visit, and which vet he can see.
//
// The caller is a stranger with a newly adopted dog. The agent learns the dog's name by asking,
// and holds no file. Settled 2026-10-03, replacing the rescue's records and the caller's surname.
//
// The staff list is the beat 2 prop. A clinic pushing its own roster as keyterms is a real business
// vocabulary, unlike one caller's surname. Drug names were tried first on 2026-10-04 and dropped:
// on the presenter's voice Flux already got Credelio right 5 of 6 times and Trifexis 2 of 5 with
// keyterms off, because brand names are in its training data. "Gutentag" is the one word proven
// both ways on his voice since 2026-09-10: misheard as "Guten Tag" and similar without keyterms,
// right with them. The lookup is exact, like a scheduling system, so a misheard name finds nobody.

export const STAFF = [
  { surname: 'Gutentag', title: 'Doctor Gutentag', newPatients: true, pronoun: 'He' },
  { surname: 'Okafor', title: 'Doctor Okafor, who speaks Spanish', newPatients: false, pronoun: 'She' },
  { surname: 'Lindqvist', title: 'Doctor Lindqvist', newPatients: false, pronoun: 'She' },
]

export const PHARMACY = [
  { name: 'Trifexis', what: 'a monthly chewable for heartworm, fleas and intestinal worms' },
  { name: 'Simparica Trio', what: 'a monthly chewable for heartworm, fleas, ticks and intestinal worms' },
  { name: 'Credelio', what: 'a monthly chewable for fleas and ticks' },
  { name: 'NexGard', what: 'a monthly chewable for fleas and ticks' },
  { name: 'Heartgard', what: 'a monthly chewable for heartworm' },
]

/** Beat 4's sentence is "Friday at ten... actually, make it one", so Friday needs both times. */
export const OPEN_NEW_PATIENT_SLOTS = 'Thursday at two in the afternoon, Friday at ten in the morning or one in the afternoon'

export function renderClinicFacts(): string {
  const staff = STAFF.map((v) =>
    `${v.title} (surname "${v.surname}"): ${v.newPatients ? `seeing new patients. ${v.pronoun} has ${OPEN_NEW_PATIENT_SLOTS}` : 'not taking new patients this month'}`,
  ).join('\n')
  const pharmacy = PHARMACY.map((p) => `${p.name}: ${p.what}`).join('\n')
  return `The vets, filed under these exact surnames and nothing else:
${staff}

Prevention products the clinic stocks:
${pharmacy}

Open new patient appointments this week, all with Doctor Gutentag: ${OPEN_NEW_PATIENT_SLOTS}`
}
