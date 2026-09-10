import { now } from './clock.ts'

// The event contract from docs/SPEC.md. Everything the dashboard shows comes from this union.
// Additions to the spec's list, each with a reason:
//   process.started  the one event a process can emit before a call exists (Phase 0 exit criterion)
//   agent.state      the state pill needs an explicit source rather than inferring from other events
//   agent.reply      what the agent said, once per turn, so the transcript zone can show both sides
//   socket.degraded  gained 'llm' as a `which`, because a slow or failed LLM degrades the same way
//   socket.recovered the banner needs a reason to go away; a reconnect is not a config.applied
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

export type DemoEventKind = DemoEvent['kind']

// What callers pass to emit(): the event without its timestamp. The bus stamps `t`.
export type DemoEventInput = DemoEvent extends infer E
  ? E extends { t: number }
    ? Omit<E, 't'>
    : never
  : never

export type Listener = (event: DemoEvent) => void

export interface Bus {
  emit(input: DemoEventInput): DemoEvent
  on(listener: Listener): () => void
  readonly log: readonly DemoEvent[]
  reset(): void
}

export function createBus(): Bus {
  const listeners = new Set<Listener>()
  const log: DemoEvent[] = []

  return {
    emit(input) {
      const event = { t: now(), ...input } as DemoEvent
      log.push(event)
      for (const listener of listeners) {
        try {
          listener(event)
        } catch (err) {
          // A broken subscriber must not take the bus, or the call, down with it.
          console.error('[bus] listener threw', err)
        }
      }
      return event
    },
    on(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    get log() {
      return log
    },
    reset() {
      log.length = 0
    },
  }
}

export const bus: Bus = createBus()
