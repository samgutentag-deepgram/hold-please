// The one customer the agent knows. Fictional, and shaped so the presenter has real questions
// to ask: what is owed, how many days are left on the package, when the standing booking runs,
// why a month cost more than the one before it.
//
// The business is a pet lodge on purpose. Liz Acosta's demo runs immediately before ours and her
// agent is Pugsley, who finds pug rescues near the caller. Ours picks the story up one step
// later: the caller adopted the pug and now has to board it. The room should feel like the
// second half of one story rather than two unrelated demos. Settled 2026-09-22.
//
// The surname on the account is the beat 2 prop: the agent needs it before it will read the
// account, and Flux hears "Gutentag" as "Guten Tag" until keyterms tell it the name exists.
// Settled 2026-09-10 after two streets lost on the presenter's own voice: Ygnacio (the keyterm
// did not take) and Tuolumne (pronounced differently from the place, so the keyterm had nothing
// to grab). The surname is the one word the presenter says the same way every time.

export interface VisitMonth {
  month: string
  daycareDays: number
  boardingNights: number
  amount: number
}

export const ACCOUNT = {
  holder: 'Sam Gutentag',
  surname: 'Gutentag',
  accountNumber: '4471-9920-33',
  petName: 'Brisket',
  petBreed: 'pug',
  petAge: 'two years old',
  adoptedFrom: 'a pug rescue, earlier this year',
  /** Pocket prop. Not gating anything; alphanumerics transcribe fine on a good mic. */
  confirmationCode: 'A7-4K-92-Q',

  plan: 'Daycare package plus boarding as needed',
  currentBalance: 187.42,
  dueDate: 'October 1',
  autopay: false,
  lastPayment: { amount: 203.18, date: 'September 2' },

  /** The recurring schedule. The thing a caller actually phones about. */
  standingDaycare: 'every Tuesday and Thursday, drop off from seven thirty, pick up by six',
  packageDaysRemaining: 7,
  packageSize: 20,
  packagePrice: 620,
  nextBooking: 'boarding, four nights over Thanksgiving week, November 25 to 29',
  lastGroom: 'September 6',
  groomEvery: 'about every six weeks',
  vaccinationsDue: 'the kennel cough booster expires October 18',

  rates: {
    daycareDropIn: 42,
    boardingNight: 68,
    groomSmallBreed: 55,
    latePickup: 15,
  },

  // Newest first. Rates went up three percent on July 1.
  history: [
    { month: 'September 2026', daycareDays: 8, boardingNights: 0, amount: 187.42 },
    { month: 'August 2026', daycareDays: 6, boardingNights: 3, amount: 203.18 },
    { month: 'July 2026', daycareDays: 9, boardingNights: 2, amount: 209.74 },
    { month: 'June 2026', daycareDays: 8, boardingNights: 0, amount: 162.33 },
    { month: 'May 2026', daycareDays: 7, boardingNights: 0, amount: 124.91 },
    { month: 'April 2026', daycareDays: 6, boardingNights: 0, amount: 120.55 },
    { month: 'March 2026', daycareDays: 8, boardingNights: 0, amount: 137.86 },
    { month: 'February 2026', daycareDays: 9, boardingNights: 0, amount: 151.49 },
    { month: 'January 2026', daycareDays: 8, boardingNights: 1, amount: 159.40 },
  ] as VisitMonth[],

  notes: [
    'Brisket does better in the small-dog yard; he was moved there in June after getting bowled over in the main yard.',
    'He is a flat-faced breed, so the lodge will not let him out in the yard above eighty degrees and moves him to indoor play instead.',
    'Buying the twenty day package instead of paying the drop-in rate has saved about nine dollars a day this year.',
  ],
}

export function renderAccount(): string {
  const a = ACCOUNT
  const rows = a.history
    .map((h) => `  ${h.month}: ${h.daycareDays} daycare days, ${h.boardingNights} boarding nights, ${h.amount.toFixed(2)} dollars`)
    .join('\n')
  return `Account holder: ${a.holder}
Account number: ${a.accountNumber}
Surname used to verify the caller (they must say this name before you discuss the account): ${a.surname}
Pet on the account: ${a.petName}, a ${a.petAge} ${a.petBreed}, adopted from ${a.adoptedFrom}
Confirmation code, only if the caller volunteers one: ${a.confirmationCode}
Plan: ${a.plan}
Current balance: ${a.currentBalance.toFixed(2)} dollars, due ${a.dueDate}
Autopay: ${a.autopay ? 'on' : 'off'}
Last payment: ${a.lastPayment.amount.toFixed(2)} dollars on ${a.lastPayment.date}
Standing daycare booking: ${a.standingDaycare}
Daycare package: ${a.packageDaysRemaining} days remaining of ${a.packageSize}, package price ${a.packagePrice} dollars
Next reservation: ${a.nextBooking}
Last groom: ${a.lastGroom}, recommended ${a.groomEvery}
Vaccinations: ${a.vaccinationsDue}
Rates: daycare drop-in ${a.rates.daycareDropIn} dollars, boarding ${a.rates.boardingNight} dollars a night, grooming for a small breed ${a.rates.groomSmallBreed} dollars, late pickup ${a.rates.latePickup} dollars
Visit history, newest first:
${rows}
Notes:
${a.notes.map((n) => `  ${n}`).join('\n')}`
}
