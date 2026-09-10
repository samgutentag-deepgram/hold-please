// The one customer the agent knows. Fictional, and shaped so the presenter has real questions
// to ask: this month's balance, two months ago, the same month last year, why it changed.
// The confirmation code is the beat 2 prop: the agent needs it before it will read the account.
// DEMO_CODE overrides it, so rehearsal can hunt for a code that fails without keyterms.

export interface BillingMonth {
  month: string
  kwh: number
  amount: number
}

export const ACCOUNT = {
  holder: 'Sam Gutentag',
  accountNumber: '4471-9920-33',
  confirmationCode: process.env['DEMO_CODE']?.trim() || 'A7-4K-92-Q',
  serviceAddress: '505 Howard Street, Suite 100, San Francisco',
  plan: 'Standard residential, flat rate',
  currentBalance: 187.42,
  dueDate: 'October 1',
  autopay: false,
  lastPayment: { amount: 203.18, date: 'September 2' },
  nextMeterRead: 'October 4',
  // Newest first. The utility raised rates 4.5 percent on January 1, 2026.
  history: [
    { month: 'September 2026', kwh: 1140, amount: 187.42 },
    { month: 'August 2026', kwh: 1265, amount: 203.18 },
    { month: 'July 2026', kwh: 1310, amount: 209.74 },
    { month: 'June 2026', kwh: 980, amount: 162.33 },
    { month: 'May 2026', kwh: 720, amount: 124.91 },
    { month: 'April 2026', kwh: 690, amount: 120.55 },
    { month: 'March 2026', kwh: 810, amount: 137.86 },
    { month: 'February 2026', kwh: 905, amount: 151.49 },
    { month: 'January 2026', kwh: 960, amount: 159.40 },
    { month: 'December 2025', kwh: 930, amount: 148.02 },
    { month: 'November 2025', kwh: 840, amount: 135.60 },
    { month: 'October 2025', kwh: 860, amount: 138.31 },
    { month: 'September 2025', kwh: 1020, amount: 160.05 },
  ] as BillingMonth[],
  notes: [
    'A time-of-use plan would have saved about 11 dollars a month over the last year based on this usage pattern.',
    'A meter exchange is scheduled for October 4 between 8 a.m. and noon; no one needs to be home.',
  ],
}

export function renderAccount(): string {
  const a = ACCOUNT
  const rows = a.history.map((h) => `  ${h.month}: ${h.kwh} kilowatt hours, ${h.amount.toFixed(2)} dollars`).join('\n')
  return `Account holder: ${a.holder}
Account number: ${a.accountNumber}
Confirmation code (the caller must read this back correctly before you discuss the account): ${a.confirmationCode}
Service address: ${a.serviceAddress}
Plan: ${a.plan}
Current balance: ${a.currentBalance.toFixed(2)} dollars, due ${a.dueDate}
Autopay: ${a.autopay ? 'on' : 'off'}
Last payment: ${a.lastPayment.amount.toFixed(2)} dollars on ${a.lastPayment.date}
Next meter read: ${a.nextMeterRead}
Billing history, newest first:
${rows}
Notes:
${a.notes.map((n) => `  ${n}`).join('\n')}`
}
