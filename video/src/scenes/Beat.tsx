import React from 'react'
import { AbsoluteFill, Sequence, useCurrentFrame } from 'remotion'
import { CaptionBand } from '../components/Caption.tsx'
import { CompareCard } from '../components/CompareCard.tsx'
import { Dashboard } from '../components/Dashboard.tsx'
import { StateChip } from '../components/Chrome.tsx'
import { ToggleMoment } from '../components/ToggleMoment.tsx'
import { carryIn, type BeatSpec } from '../fixtures/beats.ts'
import { replay } from '../replay.ts'
import type { Toggles } from '../types.ts'
import { CAPTION_H, FPS, HEIGHT, color, sec } from '../theme.ts'
import { BeatTitle } from './TitleCard.tsx'

// One beat = title card, then one continuous call, then the still that compares the two halves.
//
// The dashboard is a single mounted component for the whole run. That matters more than it
// looks: the socket-uptime counter has to climb straight through the fix, because "I did not
// reconnect" is the claim the room finds hardest to believe.

const DASH_H = HEIGHT - CAPTION_H

const Run: React.FC<{ spec: BeatSpec; n: number; carried: Partial<Toggles> }> = ({
  spec,
  n,
  carried,
}) => {
  const frame = useCurrentFrame()
  const tMs = (frame / FPS) * 1000
  const state = replay(spec.events, tMs, carried)

  let chip = spec.chips[0]
  for (const c of spec.chips) if (c.at <= frame / FPS) chip = c

  const changeStart = sec(spec.changeAt)
  const changeEnd = changeStart + sec(spec.changeDurS)
  const inChange = frame >= changeStart && frame < changeEnd

  return (
    <AbsoluteFill style={{ background: color.bg }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: DASH_H }}>
        <Dashboard state={state} height={DASH_H} />
      </div>
      {chip ? (
        <Sequence from={sec(chip.at)} key={chip.label} layout="none">
          <StateChip label={chip.label} tone={chip.tone} />
        </Sequence>
      ) : null}
      {inChange ? (
        <Sequence from={changeStart} durationInFrames={changeEnd - changeStart} layout="none">
          <ToggleMoment change={spec.change} proof={spec.proof} />
        </Sequence>
      ) : null}
      <CaptionBand cues={spec.cues} beatNumber={n} />
    </AbsoluteFill>
  )
}

export const Beat: React.FC<{
  spec: BeatSpec
  /** Position in the running order, 1-based. Never stored on the spec. */
  n: number
  carried?: Partial<Toggles>
}> = ({
  spec,
  n,
  // A beat rendered on its own for the stage fallback still needs its preconditions on, or
  // beat 3's rail shows an eager switch the app would refuse to let anyone press.
  carried = carryIn([spec], 0),
}) => (
  <AbsoluteFill style={{ background: color.bg }}>
    <Sequence durationInFrames={sec(spec.titleS)}>
      <BeatTitle n={n} name={spec.name} headline={spec.headline} />
    </Sequence>
    <Sequence from={sec(spec.titleS)} durationInFrames={sec(spec.runS)}>
      <Run spec={spec} n={n} carried={carried} />
    </Sequence>
    <Sequence from={sec(spec.titleS + spec.runS)} durationInFrames={sec(spec.compareS)}>
      <CompareCard
        title={`Beat ${n} — ${spec.name}`}
        said={spec.compare.said}
        before={spec.compare.before}
        after={spec.compare.after}
        footnote={spec.compare.footnote}
      />
    </Sequence>
  </AbsoluteFill>
)

export const beatDuration = (spec: BeatSpec) => sec(spec.titleS + spec.runS + spec.compareS)
