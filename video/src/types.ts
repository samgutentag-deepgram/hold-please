// A copy of the event contract from ../../src/bus/events.ts, not an import.
//
// The bundler here is Remotion's, not Node's type stripping, and reaching across into the
// demo's source would drag its module resolution rules into this package for no gain. The
// events are a published contract and they change rarely. If they do change, change them
// here too; `pnpm replay:check` reads a real recording and will fail loudly on a mismatch.

export type AgentState = 'idle' | 'listening' | 'thinking' | 'speaking' | 'interrupted'

export type DemoEvent =
  | { t: number; kind: 'process.started'; port: number; host: string }
  | { t: number; kind: 'call.started'; callId: string }
  | { t: number; kind: 'call.ended'; callId: string }
  | { t: number; kind: 'agent.state'; state: AgentState }
  | { t: number; kind: 'agent.reply'; turnId: string; text: string }
  | { t: number; kind: 'stt.startOfTurn' }
  | { t: number; kind: 'stt.update'; text: string; eotConfidence: number }
  | { t: number; kind: 'stt.eagerEndOfTurn'; text: string }
  | { t: number; kind: 'stt.turnResumed' }
  | { t: number; kind: 'stt.endOfTurn'; text: string; latencyMs: number }
  | { t: number; kind: 'stt.languages'; languages: string[] }
  | { t: number; kind: 'llm.speculativeStart'; turnId: string }
  | { t: number; kind: 'llm.speculativeCancel'; turnId: string }
  | { t: number; kind: 'llm.firstToken'; turnId: string; ttftMs: number }
  | { t: number; kind: 'tts.firstByte'; turnId: string; ttfbMs: number }
  | { t: number; kind: 'tts.interrupt'; textSpoken: string }
  | { t: number; kind: 'socket.degraded'; which: 'stt' | 'tts' | 'vonage' | 'llm'; detail: string }
  | { t: number; kind: 'socket.recovered'; which: 'stt' | 'tts'; attempts: number }
  | { t: number; kind: 'toggle.changed'; name: string; value: unknown }
  | { t: number; kind: 'config.applied'; reconnected: boolean; fields: string[] }

// Settled 2026-09-22, hold-please at 90a03b7. Every switch is off by default and every switch
// means "the better behaviour is on". Nothing is ever turned OFF to fix something, which is a
// stage requirement: the presenter turns a switch ON to resolve a problem.
export interface Toggles {
  /** Beat 1. Off = the agent talks over the caller and believes it was heard. */
  bargeIn: boolean
  /** Beat 2. */
  keyterms: boolean
  /** Beat 3. Requires smartEot: speculation is promoted at EndOfTurn, which a timer never emits. */
  eagerEot: boolean
  /** Beat 4. Off = a dumb 1200 ms silence timer. */
  smartEot: boolean
  eagerEotThreshold: number
  eotThreshold: number
  eotTimeoutMs: number
  /** The opener gag, and the only toggle that reconnects. */
  multilingual: boolean
}

export const DEFAULT_TOGGLES: Toggles = {
  bargeIn: false,
  keyterms: false,
  eagerEot: false,
  smartEot: false,
  eagerEotThreshold: 0.5,
  eotThreshold: 0.7,
  eotTimeoutMs: 5000,
  multilingual: false,
}

export type ToggleName = keyof Toggles
