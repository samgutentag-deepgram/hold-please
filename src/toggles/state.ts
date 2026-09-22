import type { Bus } from '../bus/events.ts'
import { validateParams } from '../stt/flux.ts'

// Toggle state, validation, broadcast. The only way anything changes on stage. In memory,
// survives across calls within a process, no persistence.
//
// The one rule this file exists to enforce: eagerEotThreshold <= eotThreshold, checked here
// before any socket sees it, because Flux drops the connection otherwise.

// Every switch is off by default and every switch means "the better behaviour is on". Nothing
// here is turned OFF to fix something: the naive agent is the starting state, and each beat turns
// one thing ON. That is a stage requirement, not a style preference. Settled 2026-09-22.
export interface Toggles {
  /** Cut the agent off when the caller starts talking, and reconcile with Interrupt. Beat 1. */
  bargeIn: boolean
  /** Send the keyterm list on the live socket. Beat 2. */
  keyterms: boolean
  /** Speculative LLM calls on EagerEndOfTurn. Beat 3. Requires smartEot. */
  eagerEot: boolean
  /** Let Flux decide the turn is over instead of a dumb silence timer. Beat 4. */
  smartEot: boolean
  eagerEotThreshold: number
  eotThreshold: number
  eotTimeoutMs: number
  /** flux-general-multi instead of flux-general-en. The opener gag. Reconnects; see Call. */
  multilingual: boolean
}

export type ToggleName = keyof Toggles
export type ToggleValue = Toggles[ToggleName]

export const DEFAULT_TOGGLES: Readonly<Toggles> = Object.freeze({
  bargeIn: false,
  keyterms: false,
  eagerEot: false,
  smartEot: false,
  eagerEotThreshold: 0.5,
  eotThreshold: 0.7,
  eotTimeoutMs: 5000,
  multilingual: false,
})

/** How long the silence timer waits before calling the turn over when smartEot is off.
 * Deliberately dumb: this is how most first voice agents are actually built. */
export const NAIVE_SILENCE_MS = 1200

export const TOGGLE_LIMITS = {
  eagerEotThreshold: { min: 0.3, max: 0.9, step: 0.05 },
  eotThreshold: { min: 0.5, max: 0.9, step: 0.05 },
  eotTimeoutMs: { min: 500, max: 60_000, step: 100 },
} as const

export type ToggleResult = { ok: true; toggles: Toggles } | { ok: false; reason: string }

export function validateToggle(current: Toggles, name: string, value: unknown): ToggleResult {
  if (!(name in DEFAULT_TOGGLES)) return { ok: false, reason: `unknown toggle ${name}` }
  const key = name as ToggleName
  const expected = typeof DEFAULT_TOGGLES[key]
  if (typeof value !== expected) return { ok: false, reason: `${name} must be a ${expected}` }

  const next: Toggles = { ...current, [key]: value }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return { ok: false, reason: `${name} must be a finite number` }
    const limits = TOGGLE_LIMITS[key as keyof typeof TOGGLE_LIMITS]
    if (limits && (value < limits.min || value > limits.max)) {
      return { ok: false, reason: `${name} must be between ${limits.min} and ${limits.max}` }
    }
  }
  // Speculation is promoted at EndOfTurn, which only exists when Flux is deciding the turn.
  // Turning eager on without smart end-of-turn would light a switch that does nothing.
  if (next.eagerEot && !next.smartEot) {
    return { ok: false, reason: 'eagerEot needs smartEot on, speculation has nothing to promote' }
  }
  const problem = validateParams({
    eotThreshold: next.eotThreshold,
    eotTimeoutMs: next.eotTimeoutMs,
    eagerEotThreshold: next.eagerEotThreshold,
  })
  if (problem) return { ok: false, reason: problem }
  return { ok: true, toggles: next }
}

export type ToggleListener = (next: Toggles, changed: ToggleName, previous: Toggles) => void

export class ToggleStore {
  private current: Toggles = { ...DEFAULT_TOGGLES }
  private listeners: ToggleListener[] = []
  private readonly bus: Bus

  constructor(bus: Bus) {
    this.bus = bus
  }

  get(): Readonly<Toggles> {
    return this.current
  }

  onChange(listener: ToggleListener): () => void {
    this.listeners.push(listener)
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener)
    }
  }

  set(name: string, value: unknown): ToggleResult {
    const result = validateToggle(this.current, name, value)
    if (!result.ok) return result
    const previous = this.current
    if (previous[name as ToggleName] === value) return { ok: true, toggles: previous }
    this.current = result.toggles
    this.bus.emit({ kind: 'toggle.changed', name, value })
    for (const listener of this.listeners) {
      try {
        listener(this.current, name as ToggleName, previous)
      } catch (err) {
        console.error('[toggles] listener threw', err)
      }
    }
    return result
  }
}

/** The keyterms beat 2 pushes onto the live socket. Tune in rehearsal; the env var overrides. */
export function keytermsFromEnv(raw: string | undefined): string[] {
  const fallback = ['Gutentag', 'Bramble Hill', 'Brisket']
  if (!raw) return fallback
  const terms = raw.split(',').map((s) => s.trim()).filter(Boolean)
  return terms.length ? terms : fallback
}
