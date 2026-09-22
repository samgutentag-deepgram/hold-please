import React from 'react'
import { AbsoluteFill, Series } from 'remotion'
import { ORDER_AS_WRITTEN, ORDER_SWAPPED, carryIn, type BeatSpec } from '../fixtures/beats.ts'
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
 * The beat order is a prop rather than a constant because it is genuinely undecided. Under
 * the settled toggle contract `eagerEot` is refused unless `smartEot` is on, so the false
 * start cannot precede the rambler without borrowing the rambler's reveal. `master` renders
 * the order as the run of show writes it, dead switch and all; `master-swapped` renders the
 * fix. Watch both, then change one constant.
 */
export const Loop: React.FC<{ order?: BeatSpec[] }> = ({ order = ORDER_AS_WRITTEN }) => (
  <AbsoluteFill style={{ background: color.bg }}>
    <Series>
      <Series.Sequence durationInFrames={sec(TITLE_S)}>
        <TitleCard />
      </Series.Sequence>
      {order.map((spec, i) => (
        <Series.Sequence key={spec.id} durationInFrames={beatDuration(spec)}>
          <Beat spec={spec} carried={carryIn(order, i)} />
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

export const Master: React.FC = () => <Loop order={ORDER_AS_WRITTEN} />
export const MasterSwapped: React.FC = () => <Loop order={ORDER_SWAPPED} />

export const masterDuration = (order: BeatSpec[] = ORDER_AS_WRITTEN) =>
  sec(TITLE_S) + order.reduce((n, b) => n + beatDuration(b), 0) + sec(CHECKLIST_S) + sec(OUTRO_S)
