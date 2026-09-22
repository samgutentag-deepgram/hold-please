import React from 'react'
import { STRIP_H, color, font } from '../theme.ts'

// On screen every frame, so that any ten seconds of the loop is self-explanatory.
//
// This exists because of where it gets played. LA is a restaurant at midday running a
// multi-sponsor summit: a viewer arrives at a random frame, standing, from about 15 feet,
// with no audio, and leaves before the loop comes round. A cold open only helps the people
// who happen to arrive at second zero. This helps everyone else, which is most of them.
//
// Everything in it is sized to survive the repo's 25 percent screenshot test.

export type Section =
  | { kind: 'coldOpen' }
  | { kind: 'title' }
  | { kind: 'beat'; n: number; total: number; name: string; headline: string }
  | { kind: 'checklist' }
  | { kind: 'outro' }

const Dots: React.FC<{ active: number; total: number }> = ({ active, total }) => (
  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
    {Array.from({ length: total }, (_, i) => (
      <span
        key={i}
        style={{
          width: i + 1 === active ? 34 : 14,
          height: 14,
          borderRadius: 999,
          background: i + 1 === active ? color.listening : i + 1 < active ? color.dim : '#2a3038',
        }}
      />
    ))}
  </div>
)

function label(section: Section): { left: string; right: string | null } {
  switch (section.kind) {
    case 'coldOpen':
      // Deliberately says nothing about what is going wrong. The strip is up so the frame
      // has no black bar across the top and so a viewer knows what they are looking at, but
      // naming the failure here would answer the question the cold open exists to ask.
      return { left: '', right: null }
    case 'title':
      return { left: 'Voice AI in production', right: null }
    case 'beat':
      return {
        left: `${section.name} — ${section.headline}`,
        right: `Beat ${section.n} of ${section.total}`,
      }
    case 'checklist':
      return { left: 'Before your agent meets a real caller', right: 'Checklist' }
    case 'outro':
      return { left: 'Everything here is open source', right: 'Take it' }
  }
}

export const OrientationStrip: React.FC<{ section: Section; opacity?: number }> = ({
  section,
  opacity = 1,
}) => {
  const { left, right } = label(section)
  const beat = section.kind === 'beat' ? section : null

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: STRIP_H,
        zIndex: 40,
        opacity,
        background: '#05070a',
        borderBottom: `2px solid ${color.line}`,
        display: 'flex',
        alignItems: 'center',
        gap: 28,
        padding: '0 40px',
      }}
    >
      <span
        style={{
          font: `900 20px/1 ${font.ui}`,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: color.speaking,
          whiteSpace: 'nowrap',
        }}
      >
        Your demo works. Your callers don&rsquo;t.
      </span>
      <span
        style={{
          font: `700 26px/1 ${font.ui}`,
          color: color.fg,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {left}
      </span>
      <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 22 }}>
        {right ? (
          <span
            style={{
              font: `800 20px/1 ${font.mono}`,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: color.dim,
              whiteSpace: 'nowrap',
            }}
          >
            {right}
          </span>
        ) : null}
        <Dots active={beat ? beat.n : 0} total={beat ? beat.total : 4} />
      </span>
    </div>
  )
}
