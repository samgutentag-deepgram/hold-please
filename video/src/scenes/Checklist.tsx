import React from 'react'
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'
import { color, font } from '../theme.ts'

// The slide that makes the loop worth watching to the end: the four beats restated as
// questions a viewer can go ask about their own agent tomorrow. Copy is docs/SCRIPT.md,
// 15:00 to 17:30, unchanged.

const ITEMS = [
  'Does it stop when they talk?',
  'Does it know what they heard before it stopped?',
  'Does it know the words your callers use that the model does not?',
  'Does it decide a turn is over by listening, or by a timer?',
]

export const Checklist: React.FC = () => {
  const frame = useCurrentFrame()
  const { fps, durationInFrames } = useVideoConfig()
  const rise = (d: number) =>
    spring({ frame: frame - d, fps, config: { damping: 200 }, durationInFrames: 16 })
  const out = interpolate(frame, [durationInFrames - 12, durationInFrames], [1, 0], {
    extrapolateLeft: 'clamp',
  })

  return (
    <AbsoluteFill
      style={{ background: color.bg, justifyContent: 'center', padding: '0 110px', gap: 46, opacity: out }}
    >
      <div
        style={{
          opacity: rise(0),
          font: `800 28px/1 ${font.ui}`,
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
          color: color.dim,
        }}
      >
        Before your voice agent meets a real caller
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 30 }}>
        {ITEMS.map((item, i) => {
          const s = rise(10 + i * 10)
          return (
            <div
              key={item}
              style={{
                opacity: s,
                transform: `translateX(${interpolate(s, [0, 1], [-28, 0])}px)`,
                display: 'flex',
                alignItems: 'baseline',
                gap: 30,
              }}
            >
              <span style={{ font: `900 44px/1 ${font.mono}`, color: color.listening, minWidth: 66 }}>
                {i + 1}
              </span>
              <span style={{ font: `700 58px/1.18 ${font.ui}`, color: color.fg }}>{item}</span>
            </div>
          )
        })}
      </div>
      <div style={{ opacity: rise(56), font: `600 36px/1.35 ${font.ui}`, color: color.dim, maxWidth: 1500 }}>
        Every one of those failed here, and every fix was one message on a socket that was
        already open.
      </div>
    </AbsoluteFill>
  )
}
