import React from 'react'
import { AbsoluteFill, Series, useCurrentFrame } from 'remotion'
import { OrientationStrip, type Section } from '../components/OrientationStrip.tsx'
import { ORDER, carryIn } from '../fixtures/beats.ts'
import { STRIP_H, color, sec } from '../theme.ts'
import { Beat, beatDuration } from './Beat.tsx'
import { Checklist } from './Checklist.tsx'
import { ColdOpen, coldOpenDuration } from './ColdOpen.tsx'
import { Outro } from './Outro.tsx'
import { TitleCard } from './TitleCard.tsx'

export const TITLE_S = 8
export const CHECKLIST_S = 14
export const OUTRO_S = 10

/**
 * The loop's sections, with their frame ranges, built once and used twice: `Series` plays
 * them and the orientation strip reads them to say which one is on screen. Deriving both
 * from the same array is the same rule as `ORDER` and `carryIn` — if a duration changes,
 * nothing can be left announcing the wrong thing.
 */
interface Slot {
  from: number
  duration: number
  section: Section
}

function buildTimeline(): Slot[] {
  const slots: Slot[] = []
  let at = 0
  const push = (duration: number, section: Section) => {
    slots.push({ from: at, duration, section })
    at += duration
  }

  push(coldOpenDuration(), { kind: 'coldOpen' })
  push(sec(TITLE_S), { kind: 'title' })
  ORDER.forEach((spec, i) =>
    push(beatDuration(spec), {
      kind: 'beat',
      n: i + 1,
      total: ORDER.length,
      name: spec.name,
      headline: spec.headline,
    }),
  )
  push(sec(CHECKLIST_S), { kind: 'checklist' })
  push(sec(OUTRO_S), { kind: 'outro' })
  return slots
}

export const TIMELINE = buildTimeline()

const Strip: React.FC = () => {
  const frame = useCurrentFrame()
  const slot = TIMELINE.find((s) => frame >= s.from && frame < s.from + s.duration) ?? TIMELINE[0]
  return <OrientationStrip section={slot.section} />
}

/**
 * The booth loop: cold open, title, four beats, checklist, outro, back to the cold open.
 *
 * Beat numbers come from position in `ORDER`, never from the specs, so the sequence can move
 * again without leaving a caption claiming to be beat 3 while it plays fourth.
 */
export const Master: React.FC = () => (
  <AbsoluteFill style={{ background: color.bg }}>
    {/* Everything below the strip. Scenes are AbsoluteFill and fill this box, not the frame. */}
    <AbsoluteFill style={{ top: STRIP_H }}>
      <Series>
        <Series.Sequence durationInFrames={coldOpenDuration()}>
          <ColdOpen />
        </Series.Sequence>
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
    <Strip />
  </AbsoluteFill>
)

export const masterDuration = () =>
  TIMELINE.reduce((n, slot) => n + slot.duration, 0)
