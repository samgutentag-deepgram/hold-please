import type Anthropic from '@anthropic-ai/sdk'
import type { AgentState, Bus } from '../bus/events.ts'
import { now } from '../bus/clock.ts'
import type { AudioLeg } from '../audio/leg.ts'
import type { PlaybackClock } from '../audio/playback.ts'
import type { FluxStt, TurnInfo } from '../stt/flux.ts'
import type { FluxTts, TtsServerMessage } from '../tts/fluxTts.ts'
import { NAIVE_SILENCE_MS, type Toggles } from '../toggles/state.ts'
import { describeLlmError, type Llm } from './llm.ts'
import { FALLBACK_LINE, GREETING } from './prompt.ts'

// Turn orchestration. Flux decides when the caller has finished; this loop decides what the
// agent does about it. Two personalities, selected by the toggles, on the same sockets:
//
//   Fixed (naiveMode off)
//     StartOfTurn while speaking  -> barge-in: cut audio, Interrupt with the playback offset
//     EagerEndOfTurn (if eagerEot)-> start a speculative LLM turn, buffered, not spoken
//     TurnResumed                 -> cancel it
//     EndOfTurn                   -> promote the speculative turn, or start one; stream into TTS
//     SpeechInterrupted           -> the transcript keeps only what the caller heard
//
//   Naive (naiveMode on), the way most first voice agents are actually built
//     ignore Flux's turn events; a fixed silence timer decides the turn is over
//     no barge-in: the agent finishes its sentence over the caller
//     no Interrupt reconciliation, so the transcript believes everything was heard

export interface LoopDeps {
  bus: Bus
  leg: AudioLeg
  stt: FluxStt
  tts: FluxTts
  llm: Llm
  playback: PlaybackClock
  toggles: () => Readonly<Toggles>
}

interface Turn {
  turnId: string
  abort: AbortController
  spoken: string
  /** Text produced before the turn was promoted to speech. Speculative turns buffer here. */
  buffered: string
  speculative: boolean
  startedAt: number
  userText: string
}

export class AgentLoop {
  private state: AgentState = 'idle'
  private history: Anthropic.MessageParam[] = []
  private current: Turn | null = null
  private turnCounter = 0
  private listenTimer: NodeJS.Timeout | null = null
  private naiveTimer: NodeJS.Timeout | null = null
  private naiveText = ''
  private readonly deps: LoopDeps

  constructor(deps: LoopDeps) {
    this.deps = deps
    this.attachStt(deps.stt)
    deps.tts.onMessage((msg) => this.onTtsMessage(msg))
    deps.tts.onAudio((pcm) => {
      deps.leg.send(pcm)
      deps.playback.push(pcm.length)
    })
  }

  /** Listen to a (possibly replacement) Flux socket. Used when the model toggle reconnects. */
  attachStt(stt: FluxStt): void {
    stt.onTurn((info) => this.onTurn(info))
  }

  start(): void {
    this.say('greeting', GREETING)
    this.history.push({ role: 'assistant', content: GREETING })
    this.deps.bus.emit({ kind: 'agent.reply', turnId: 'greeting', text: GREETING })
  }

  stop(): void {
    this.current?.abort.abort()
    if (this.listenTimer) clearTimeout(this.listenTimer)
    if (this.naiveTimer) clearTimeout(this.naiveTimer)
    this.setState('idle')
  }

  private get naive(): boolean {
    return this.deps.toggles().naiveMode
  }

  private setState(state: AgentState): void {
    if (state === this.state) return
    this.state = state
    this.deps.bus.emit({ kind: 'agent.state', state })
  }

  // ---- Flux turn events -------------------------------------------------------------------

  private onTurn(info: TurnInfo): void {
    if (this.naive) {
      this.onTurnNaive(info)
      return
    }
    switch (info.event) {
      case 'StartOfTurn':
        // The Flux agent guide's rule: interrupt if speaking, otherwise wait.
        if (this.state === 'speaking') this.bargeIn()
        else if (this.state !== 'thinking') this.setState('listening')
        return
      case 'EagerEndOfTurn':
        if (this.deps.toggles().eagerEot && info.transcript.trim()) this.speculate(info.transcript.trim())
        return
      case 'TurnResumed':
        this.cancelSpeculation()
        return
      case 'EndOfTurn':
        if (info.transcript.trim()) void this.respond(info.transcript.trim())
        return
      default:
        return
    }
  }

  /** A silence timer instead of turn detection. Fires mid-sentence on any pause. */
  private onTurnNaive(info: TurnInfo): void {
    if (info.event === 'StartOfTurn' && this.state !== 'speaking' && this.state !== 'thinking') {
      this.setState('listening')
    }
    if (info.transcript.trim()) this.naiveText = info.transcript.trim()
    if (info.event === 'EndOfTurn') {
      // Flux has moved on to the next turn index; whatever we have is what the timer will use.
      this.armNaiveTimer()
      return
    }
    if (info.transcript.trim()) this.armNaiveTimer()
  }

  private armNaiveTimer(): void {
    if (this.naiveTimer) clearTimeout(this.naiveTimer)
    this.naiveTimer = setTimeout(() => {
      this.naiveTimer = null
      const text = this.naiveText
      this.naiveText = ''
      if (text) void this.respond(text)
    }, NAIVE_SILENCE_MS)
    this.naiveTimer.unref()
  }

  // ---- Barge-in -----------------------------------------------------------------------------

  private bargeIn(): void {
    const { leg, playback, tts } = this.deps
    // Stop the audio first. The Interrupt round trip is for reconciliation, not for silence.
    leg.clear()
    playback.clear()
    this.current?.abort.abort()
    tts.interrupt(playback.playedMs())
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

  // ---- LLM turns --------------------------------------------------------------------------

  /** Beat 3: start the LLM early on a medium-confidence transcript, buffer, do not speak. */
  private speculate(userText: string): void {
    if (this.current?.speculative && this.current.userText === userText) return
    this.cancelSpeculation()
    const turn = this.newTurn(userText, true)
    this.deps.bus.emit({ kind: 'llm.speculativeStart', turnId: turn.turnId })
    void this.run(turn)
  }

  private cancelSpeculation(): void {
    const turn = this.current
    if (!turn?.speculative) return
    turn.abort.abort()
    this.current = null
    this.deps.bus.emit({ kind: 'llm.speculativeCancel', turnId: turn.turnId })
  }

  private async respond(userText: string): Promise<void> {
    if (this.listenTimer) clearTimeout(this.listenTimer)
    const speculative = this.current?.speculative ? this.current : null

    if (speculative && speculative.userText === userText) {
      // The guess was right. Promote it: speak what has buffered, keep streaming the rest.
      speculative.speculative = false
      this.history.push({ role: 'user', content: userText })
      this.setState('thinking')
      if (speculative.buffered) this.promote(speculative)
      return
    }

    this.current?.abort.abort()
    this.current = null
    const turn = this.newTurn(userText, false)
    this.history.push({ role: 'user', content: userText })
    this.setState('thinking')
    await this.run(turn)
  }

  private newTurn(userText: string, speculative: boolean): Turn {
    const turn: Turn = {
      turnId: `turn-${++this.turnCounter}`,
      abort: new AbortController(),
      spoken: '',
      buffered: '',
      speculative,
      startedAt: now(),
      userText,
    }
    this.current = turn
    return turn
  }

  /** First spoken text of a turn: time it, switch the TTS turn on, move to speaking. */
  private promote(turn: Turn): void {
    const { bus, tts } = this.deps
    bus.emit({ kind: 'llm.firstToken', turnId: turn.turnId, ttftMs: Math.round(now() - turn.startedAt) })
    tts.beginTurn(turn.turnId)
    this.setState('speaking')
    if (turn.buffered) {
      tts.speak(turn.buffered)
      turn.spoken += turn.buffered
      turn.buffered = ''
    }
  }

  private async run(turn: Turn): Promise<void> {
    const { bus, llm, tts } = this.deps
    // Speculative turns see the history plus the guessed user text; real turns already pushed it.
    const messages: Anthropic.MessageParam[] = turn.speculative
      ? [...this.history, { role: 'user', content: turn.userText }]
      : this.history
    let promoted = false
    try {
      for await (const delta of llm.stream(messages, turn.abort.signal)) {
        if (turn.abort.signal.aborted) return
        if (turn.speculative) {
          turn.buffered += delta
          continue
        }
        if (!promoted) {
          promoted = true
          this.promote(turn)
        }
        turn.spoken += delta
        tts.speak(delta)
      }
      if (turn.abort.signal.aborted) return
      if (turn.speculative) {
        // Finished generating before Flux confirmed the turn. Hold it; respond() will promote.
        return
      }
      if (!promoted) {
        if (turn.buffered) this.promote(turn)
        else throw new Error('the model returned no text')
      }
      tts.flush()
      this.history.push({ role: 'assistant', content: turn.spoken })
      bus.emit({ kind: 'agent.reply', turnId: turn.turnId, text: turn.spoken })
    } catch (err) {
      if (turn.abort.signal.aborted) return
      bus.emit({ kind: 'socket.degraded', which: 'llm', detail: describeLlmError(err) })
      // Silence on stage reads as a crash. Say something.
      this.history.push({ role: 'assistant', content: FALLBACK_LINE })
      this.say(turn.turnId, FALLBACK_LINE)
      bus.emit({ kind: 'agent.reply', turnId: turn.turnId, text: FALLBACK_LINE })
    } finally {
      if (this.current === turn && !turn.speculative && this.state !== 'speaking') this.current = null
    }
  }
}
