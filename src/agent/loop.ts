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
import { SCRIPT, matchStep } from './script.ts'

// Turn orchestration. Flux decides when the caller has finished; this loop decides what the
// agent does about it. Two personalities, selected by the toggles, on the same sockets:
//
// Two behaviours, and they are independent, which is the point. Barge-in is about what happens
// while the agent is speaking. Turn detection is about who decides the caller finished. Bundling
// them into one "naive mode" switch meant beat 1 and beat 4 shared a lever, and meant fixing
// things by switching them off. Both are now their own toggle, both default off.
//
//   bargeIn off  the agent talks over the caller and never learns what was heard
//   bargeIn on   StartOfTurn while speaking cuts the audio and sends Interrupt with the
//                playback offset; SpeechInterrupted trims history to what the caller heard
//
//   smartEot off a fixed silence timer decides the turn is over, firing on any pause
//   smartEot on  Flux's EndOfTurn decides, with EagerEndOfTurn driving speculation when
//                eagerEot is also on, and TurnResumed cancelling it

export interface LoopDeps {
  bus: Bus
  leg: AudioLeg
  stt: FluxStt
  tts: FluxTts
  llm: Llm
  playback: PlaybackClock
  toggles: () => Readonly<Toggles>
}

const NOT_HEARD = '(interrupted before saying anything)'

const norm = (s: string): string => s.toLowerCase().replace(/\s+/g, ' ').trim()

/** Rewrite history to what the caller actually heard. With barge-in off, replies queue up behind
 *  each other, so the interrupted one is not necessarily the last. Assistant entries from `from`
 *  on are matched by text: the one `textSpoken` starts is cut to it, earlier ones were heard in
 *  full, later ones were never heard. Returns false when no entry matches, and changes nothing. */
export function reconcileHeard(history: Anthropic.MessageParam[], from: number, textSpoken: string): boolean {
  const spoken = norm(textSpoken)
  const head = spoken.slice(0, 24)
  const candidates = history.slice(from).filter((m) => m.role === 'assistant' && typeof m.content === 'string')
  const playing = head ? candidates.findIndex((m) => norm(m.content as string).startsWith(head)) : candidates.length ? 0 : -1
  if (playing < 0) return false
  candidates[playing]!.content = textSpoken.trim() || NOT_HEARD
  for (const later of candidates.slice(playing + 1)) later.content = NOT_HEARD
  return true
}

interface Turn {
  turnId: string
  abort: AbortController
  spoken: string
  /** Text produced before the turn was promoted to speech. Speculative turns buffer here. */
  buffered: string
  speculative: boolean
  /** In history yet. A reply cut off mid-stream is committed with what had been sent to speech. */
  committed: boolean
  startedAt: number
  userText: string
}

export class AgentLoop {
  private state: AgentState = 'idle'
  private history: Anthropic.MessageParam[] = []
  /** History before this index has been heard in full; only entries after it can be cut. */
  private heardUpTo = 0
  /** Which script step a caller line completed, for the dashboard rail. Off-script lines have none. */
  private stepOf = new WeakMap<Anthropic.MessageParam, number>()
  private current: Turn | null = null
  private turnCounter = 0
  private listenTimer: NodeJS.Timeout | null = null
  private naiveTimer: NodeJS.Timeout | null = null
  private naiveText = ''
  /** The part of the current turn's transcript the timer has already answered. */
  private naiveSent = ''
  private naiveTurn = -1
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

  private get smartEot(): boolean {
    return this.deps.toggles().smartEot
  }

  private setState(state: AgentState): void {
    if (state === this.state) return
    this.state = state
    this.deps.bus.emit({ kind: 'agent.state', state })
  }

  // ---- Flux turn events -------------------------------------------------------------------

  private onTurn(info: TurnInfo): void {
    const toggles = this.deps.toggles()

    // Barge-in first, and regardless of who is deciding turns. The Flux agent guide's rule:
    // interrupt if speaking, otherwise wait.
    if (info.event === 'StartOfTurn') {
      if (toggles.bargeIn && this.state === 'speaking') this.bargeIn()
      else if (this.state !== 'speaking' && this.state !== 'thinking') this.setState('listening')
    }

    if (!this.smartEot) {
      this.onTurnNaive(info)
      return
    }

    switch (info.event) {
      case 'StartOfTurn':
        return // handled above
      case 'EagerEndOfTurn':
        if (toggles.eagerEot && info.transcript.trim()) this.speculate(info.transcript.trim())
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

  /** A silence timer instead of turn detection. Fires mid-sentence on any pause. State on
   *  StartOfTurn is already handled in onTurn, because barge-in does not depend on this. */
  private onTurnNaive(info: TurnInfo): void {
    const text = info.transcript.trim()
    if (info.turn_index !== this.naiveTurn) {
      // A new turn. Flux sends its first words before StartOfTurn, so the turn index is the
      // boundary, not the event. Anything still owed from the last turn goes now.
      if (this.naiveTimer) this.fireNaiveTimer()
      this.naiveTurn = info.turn_index
      this.naiveText = ''
      this.naiveSent = ''
    }
    // Only new words reset the timer. Flux keeps sending Updates through a pause with the same
    // transcript, and re-arming on those meant the timer never fired mid-turn: the "broken" mode
    // was just EndOfTurn plus 1.2 seconds. Found 2026-10-04 in the 2026-09-29 recordings.
    if (text && text !== this.naiveText) {
      this.naiveText = text
      this.armNaiveTimer()
    }
  }

  private armNaiveTimer(): void {
    if (this.naiveTimer) clearTimeout(this.naiveTimer)
    this.naiveTimer = setTimeout(() => this.fireNaiveTimer(), NAIVE_SILENCE_MS)
    this.naiveTimer.unref()
  }

  /** Answer whatever the caller said since the timer last fired. Mid-turn this is half a thought. */
  private fireNaiveTimer(): void {
    if (this.naiveTimer) clearTimeout(this.naiveTimer)
    this.naiveTimer = null
    const full = this.naiveText
    const text = full.startsWith(this.naiveSent) ? full.slice(this.naiveSent.length).trim() : full
    this.naiveSent = full
    if (text) void this.respond(text)
  }

  // ---- Barge-in -----------------------------------------------------------------------------

  private bargeIn(): void {
    const { leg, playback, tts } = this.deps
    // Stop the audio first. The Interrupt round trip is for reconciliation, not for silence.
    leg.clear()
    playback.clear()
    this.commitPartial()
    this.current?.abort.abort()
    tts.interrupt(playback.playedMs())
    this.setState('interrupted')
    this.setState('listening')
  }

  /** The presenter's stop key. Silences the agent whatever the toggles say, and drops any reply
   *  still queued, so it never talks over an explanation to the room. Still reconciles history
   *  to what was heard, so the next turn does not refer to words nobody heard. */
  hush(by: 'presenter' | 'seek' = 'presenter'): void {
    if (this.listenTimer) clearTimeout(this.listenTimer)
    if (this.naiveTimer) clearTimeout(this.naiveTimer)
    this.naiveTimer = null
    this.naiveText = ''
    this.naiveSent = ''
    const speaking = this.state === 'speaking'
    if (!speaking && !this.current) return
    const { bus, leg, playback, tts } = this.deps
    leg.clear()
    playback.clear()
    this.commitPartial()
    this.current?.abort.abort()
    this.current = null
    if (speaking) tts.interrupt(playback.playedMs(), by)
    bus.emit({ kind: 'agent.hushed' })
    this.setState('listening')
  }

  /** The presenter's undo key. Drops the last thing the caller said and everything after it, so a
   *  beat can be run again from the same point without the agent remembering the first attempt. */
  rewind(): void {
    this.hush()
    const lastUser = this.history.findLastIndex((m) => m.role === 'user')
    if (lastUser < 0) return
    this.history.length = lastUser
    this.heardUpTo = Math.min(this.heardUpTo, this.history.length)
    this.deps.bus.emit({ kind: 'agent.rewound', turnsLeft: this.history.filter((m) => m.role === 'user').length })
    this.emitProgress()
  }

  private doneSteps(): Set<number> {
    const done = new Set<number>()
    for (const m of this.history) {
      const step = this.stepOf.get(m)
      if (step !== undefined) done.add(step)
    }
    return done
  }

  private pushCaller(text: string): void {
    const msg: Anthropic.MessageParam = { role: 'user', content: text }
    const step = matchStep(text, this.doneSteps())
    if (step !== null) this.stepOf.set(msg, step)
    this.history.push(msg)
    this.emitProgress()
  }

  /** The steps the agent's memory has completed. The dashboard's script rail is its playhead. */
  private emitProgress(): void {
    this.deps.bus.emit({ kind: 'agent.progress', done: [...this.doneSteps()].sort((a, b) => a - b) })
  }

  /** Jump the conversation to just before script step `step`: the agent's memory becomes the
   *  canned happy path up to there. The caller sets the switches; this only owns memory. */
  seek(step: number): void {
    const wasSpeaking = this.state === 'speaking'
    this.hush('seek')
    this.history = [{ role: 'assistant', content: GREETING }]
    for (const [i, s] of SCRIPT.slice(0, Math.max(0, step)).entries()) {
      const caller: Anthropic.MessageParam = { role: 'user', content: s.caller }
      this.stepOf.set(caller, i)
      this.history.push(caller, { role: 'assistant', content: s.agent })
    }
    this.heardUpTo = this.history.length
    this.emitProgress()
    // Each beat opens with the agent asking its question out loud, so the presenter and the room
    // both know what the next line is answering. It is already the last line in memory.
    // If the agent was mid-sentence, wait for the interrupt to land first, or the tail of the old
    // reply plays in front of the cue.
    const cue = this.history.at(-1)
    if (cue?.role !== 'assistant' || typeof cue.content !== 'string') return
    this.pendingCue = { turnId: `seek-${step}`, text: cue.content }
    if (this.cueTimer) clearTimeout(this.cueTimer)
    if (!wasSpeaking) this.speakCue()
    else {
      this.cueTimer = setTimeout(() => this.speakCue(), 900)
      this.cueTimer.unref()
    }
  }

  private pendingCue: { turnId: string; text: string } | null = null
  private cueTimer: NodeJS.Timeout | null = null

  private speakCue(): void {
    if (this.cueTimer) clearTimeout(this.cueTimer)
    this.cueTimer = null
    const cue = this.pendingCue
    this.pendingCue = null
    if (!cue) return
    this.say(cue.turnId, cue.text)
    this.deps.bus.emit({ kind: 'agent.reply', turnId: cue.turnId, text: cue.text })
  }

  /** A reply cut off while still streaming has not reached history yet, but the caller heard part
   *  of it. Commit what was sent to speech so the interrupt can trim it to what was heard. */
  private commitPartial(): void {
    const turn = this.current
    if (!turn || turn.speculative || turn.committed || !turn.spoken) return
    turn.committed = true
    this.history.push({ role: 'assistant', content: turn.spoken })
  }

  private onTtsMessage(msg: TtsServerMessage): void {
    // A seek's cue waits for the interrupt it sent to land, or for the server to say there was
    // nothing to interrupt.
    if (this.pendingCue && (msg.type === 'SpeechInterrupted' || msg.type === 'Warning')) {
      queueMicrotask(() => this.speakCue())
      if (msg.type === 'SpeechInterrupted') { this.current = null; return }
    }
    if (msg.type === 'SpeechInterrupted') {
      // Keep only what the caller actually heard, so the next turn does not repeat it.
      if (msg.text_spoken !== undefined) reconcileHeard(this.history, this.heardUpTo, msg.text_spoken)
      this.heardUpTo = this.history.length
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
      // Every queued reply has played out, so everything in history so far was heard in full.
      this.heardUpTo = this.history.length
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
      this.pushCaller(userText)
      this.setState('thinking')
      if (speculative.buffered) this.promote(speculative)
      return
    }

    // A guess on different words is a thrown-away model call. Say so, so the dashboard counts it.
    if (speculative) this.cancelSpeculation()
    this.current?.abort.abort()
    this.current = null
    const turn = this.newTurn(userText, false)
    this.pushCaller(userText)
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
      committed: false,
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
      turn.committed = true
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
