// The one file the agent knows. Fictional, and shaped so the presenter has real questions to ask
// as a brand new client of a vet: what happens at a first wellness exam, which shots are due,
// whether the microchip hurts, and whether all of it can happen in one visit.
//
// The storyline picks up from Liz Acosta's demo, which runs immediately before ours: her agent
// helps a caller find a pug rescue. Ours is the next call that caller makes. He adopted the pug,
// the rescue forwarded the dog's records to a new vet, and now he is phoning to get him signed up
// as a patient: shots, a wellness exam, and a microchip. Settled 2026-10-01, replacing the pet
// lodge from 2026-09-29.
//
// The surname is the beat 2 prop: the rescue's records are filed under the owner's last name, so
// the agent needs it before it will discuss this dog, and Flux hears "Gutentag" as "Guten Tag"
// until keyterms tell it the name exists. Settled 2026-09-10 after two streets lost on the
// presenter's own voice. The surname is the one word the presenter says the same way every time.

export const PATIENT_FILE = {
  owner: 'Sam Gutentag',
  surname: 'Gutentag',
  petName: 'Otto',
  petBreed: 'pug',
  petAge: 'two years old',
  petWeight: 'about nineteen pounds',
  adoptedFrom: 'a pug rescue, earlier this month',
  status: 'records received from the rescue, not yet registered as a patient',

  vaccinations: {
    rabies: 'given at the rescue, but it was a one year shot and it is due now',
    dhpp: 'the distemper combination booster is due',
    bordetella: 'not on file, recommended',
    leptospirosis: 'optional, the vet will talk it through at the exam',
  },
  microchip: 'none on file',
  rescueNotes: 'Friendly, a little nervous in the car and around big dogs. Snores.',

  /** What the agent summarizes on a match, in one or two sentences. */
  needs: 'his rabies and DHPP boosters are due, there is no microchip on file, and he needs a new patient exam',

  /** Beat 4's sentence is "Thursday... actually, make it Friday", so both days need an answer. */
  openNewPatientSlots: 'Thursday at two in the afternoon, Friday at ten in the morning or one in the afternoon',
}

export function renderPatientFile(): string {
  const p = PATIENT_FILE
  return `Owner: ${p.owner}
Surname the file is filed under (the caller must say this name before you discuss this dog): ${p.surname}
Dog: ${p.petName}, a ${p.petAge} ${p.petBreed}, ${p.petWeight}, adopted from ${p.adoptedFrom}
Status: ${p.status}
Rabies: ${p.vaccinations.rabies}
DHPP, the distemper combination shot: ${p.vaccinations.dhpp}
Bordetella, the kennel cough shot: ${p.vaccinations.bordetella}
Leptospirosis: ${p.vaccinations.leptospirosis}
Microchip: ${p.microchip}
Notes from the rescue: ${p.rescueNotes}
What he needs: ${p.needs}
Open new patient appointments this week: ${p.openNewPatientSlots}`
}
