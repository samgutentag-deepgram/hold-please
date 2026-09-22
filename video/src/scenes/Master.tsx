import React from 'react'
import { AbsoluteFill, Series } from 'remotion'
import { ORDER, carryIn } from '../fixtures/beats.ts'
import { color, sec } from '../theme.ts'
import { Beat, beatDuration } from './Beat.tsx'
import { Checklist } from './Checklist.tsx'
import { Outro } from './Outro.tsx'
import { TitleCard } from './TitleCard.tsx'

export const TITLE_S = 8
export const CHECKLIST_S = 14
export const OUTRO_S = 10

/**
 * The booth loop: title, four beats, checklist, outro, cut back to the title.
 *
 * Beat numbers come from position in `ORDER`, never from the specs, so the sequence can move
 * again without leaving a caption claiming to be beat 3 while it plays fourth.
 */
export const Master: React.FC = () => (
  <AbsoluteFill style={{ background: color.bg }}>
    <Series>
      <Series.Sequence durationInFrames={sec(TITLE_S)}>
        <TitleCard />
      </Series.Sequence>
      {ORDER.map((spec, i) => (
        <Series.Sequence key={spec.id} durationInFrames={beatDuration(spec)}>
          <Beat spec={spec} n={i + 1} carried={carryIn(ORDER, i)} />
        </Series.Sequence>
      ))}
      <Series.Sequence durationInFrames={sec(CHECKLIST_S)}>
        <Checklist />
      </Series.Sequence>
      <Series.Sequence durationInFrames={sec(OUTRO_S)}>
        <Outro />
      </Series.Sequence>
    </Series>
  </AbsoluteFill>
)

export const masterDuration = () =>
  sec(TITLE_S) + ORDER.reduce((n, b) => n + beatDuration(b), 0) + sec(CHECKLIST_S) + sec(OUTRO_S)
