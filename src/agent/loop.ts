import type Anthropic from '@anthropic-ai/sdk'
import type { AgentState, Bus } from '../bus/events.ts'
import { now } from '../bus/clock.ts'
import type { AudioLeg } from '../audio/leg.ts'
import type { PlaybackClock } from '../audio/playback.ts'
import type { FluxStt, TurnInfo } from '../stt/flux.ts'
import type { FluxTts, TtsServerMessage } from '../tts/fluxTts.ts'
import { describeLlmError, type Llm } from './llm.ts'
import { FALLBACK_LINE, GREETING } from './prompt.ts'

// Turn orchestration. Flux decides when the caller has finished; this loop decides what the
// agent does about it. Phase 1 is the EndOfTurn-only pattern from the Flux agent guide plus
// barge-in. Eager end-of-turn speculation arrives with the toggles.
//
//   StartOfTurn while speaking  -> barge-in: cut audio, Interrupt with the playback offset
//   EndOfTurn                   -> one LLM turn, streamed straight into Flux TTS
//   SpeechInterrupted           -> the transcript keeps only what the caller heard

export interface LoopDeps {
  bus: Bus
  leg: AudioLeg
  stt: FluxStt
  tts: FluxTts
  llm: Llm
  playback: PlaybackClock
}

export class AgentLoop {
  private state: AgentState = 'idle'
  private history: Anthropic.MessageParam[] = []
  private current: { turnId: string; abort: AbortController; spoken: string } | null = null
  private turnCounter = 0
  private listenTimer: NodeJS.Timeout | null = null

  private readonly deps: LoopDeps

  constructor(deps: LoopDeps) {
    this.deps = deps
    deps.stt.onTurn((info) => this.onTurn(info))
    deps.tts.onMessage((msg) => this.onTtsMessage(msg))
    deps.tts.onAudio((pcm) => {
      deps.leg.send(pcm)
      deps.playback.push(pcm.length)
    })
  }

  start(): void {
    this.say('greeting', GREETING)
    this.history.push({ role: 'assistant', content: GREETING })
  }

  private setState(state: AgentState): void {
    if (state === this.state) return
    this.state = state
    this.deps.bus.emit({ kind: 'agent.state', state })
  }

  private onTurn(info: TurnInfo): void {
    switch (info.event) {
      case 'StartOfTurn':
        if (this.state === 'speaking' || this.state === 'thinking') this.bargeIn()
        else this.setState('listening')
        return
      case 'EndOfTurn':
        if (info.transcript.trim()) void this.respond(info.transcript.trim())
        return
      default:
        return
    }
  }

  private bargeIn(): void {
    const { leg, playback, tts } = this.deps
    // Stop the audio first. The Interrupt round trip is for reconciliation, not for silence.
    leg.clear()
    playback.clear()
    this.current?.abort.abort()
    if (this.state === 'speaking') tts.interrupt(playback.playedMs())
    this.setState('interrupted')
    this.setState('listening')
  }

  private onTtsMessage(msg: TtsServerMessage): void {
    if (msg.type === 'SpeechInterrupted') {
      // Keep only what the caller actually heard, so the next turn does not repeat it.
      const last = this.history.at(-1)
      if (msg.text_spoken !== undefined && last?.role === 'assistant') {
        last.content = msg.text_spoken.trim() || '(interrupted before saying anything)'
      }
      this.current = null
      return
    }
    if (msg.type === 'SpeechMetadata') {
      // All audio for the turn has been sent; the caller hears the tail for remainingMs more.
      this.scheduleListening(this.deps.playback.remainingMs())
    }
  }

  private scheduleListening(afterMs: number): void {
    if (this.listenTimer) clearTimeout(this.listenTimer)
    this.listenTimer = setTimeout(() => {
      if (this.state === 'speaking') this.setState('listening')
    }, Math.max(0, afterMs))
    this.listenTimer.unref()
  }

  private say(turnId: string, text: string): void {
    const { tts } = this.deps
    this.setState('speaking')
    tts.beginTurn(turnId)
    tts.speak(text)
    tts.flush()
  }

  private async respond(userText: string): Promise<void> {
    const { bus, llm, tts } = this.deps
    this.current?.abort.abort()
    if (this.listenTimer) clearTimeout(this.listenTimer)

    const turnId = `turn-${++this.turnCounter}`
    const abort = new AbortController()
    const turn = { turnId, abort, spoken: '' }
    this.current = turn
    this.history.push({ role: 'user', content: userText })
    this.setState('thinking')

    const startedAt = now()
    let first = true
    try {
      for await (const delta of llm.stream(this.history, abort.signal)) {
        if (abort.signal.aborted) break
        if (first) {
          first = false
          bus.emit({ kind: 'llm.firstToken', turnId, ttftMs: Math.round(now() - startedAt) })
          tts.beginTurn(turnId)
          this.setState('speaking')
        }
        turn.spoken += delta
        tts.speak(delta)
      }
      if (abort.signal.aborted) return
      if (first) throw new Error('the model returned no text')
      tts.flush()
      this.history.push({ role: 'assistant', content: turn.spoken })
    } catch (err) {
      if (abort.signal.aborted) return
      bus.emit({ kind: 'socket.degraded', which: 'llm', detail: describeLlmError(err) })
      // Silence on stage reads as a crash. Say something.
      this.history.push({ role: 'assistant', content: FALLBACK_LINE })
      this.say(turnId, FALLBACK_LINE)
    } finally {
      if (this.current === turn && this.state !== 'speaking') this.current = null
    }
  }

  stop(): void {
    this.current?.abort.abort()
    if (this.listenTimer) clearTimeout(this.listenTimer)
    this.setState('idle')
  }
}
