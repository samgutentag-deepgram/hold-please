import React from 'react'
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'
import { color, font } from '../theme.ts'

/**
 * The chip that says which half of the beat you are watching. It sits at the right end of the
 * caption band rather than over the dashboard, because the dashboard's own title lives in the
 * top left and covering it would break the "this is the real app" illusion the whole video runs on.
 */
export const StateChip: React.FC<{ label: string; tone: 'bad' | 'good' | 'neutral' }> = ({
  label,
  tone,
}) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const s = spring({ frame, fps, config: { damping: 200 }, durationInFrames: 12 })
  const bg = tone === 'bad' ? color.interrupted : tone === 'good' ? color.listening : color.idle
  return (
    <div
      style={{
        position: 'absolute',
        bottom: 62,
        right: 56,
        transform: `scale(${interpolate(s, [0, 1], [0.86, 1])})`,
        transformOrigin: 'right center',
        background: bg,
        color: '#000',
        font: `900 34px/1 ${font.ui}`,
        letterSpacing: '0.1em',
        padding: '18px 30px',
        borderRadius: 12,
        zIndex: 25,
        opacity: s,
      }}
    >
      {label}
    </div>
  )
}

/** A big soft-edged card used by the title, compare and checklist scenes. */
export const Panel: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({
  children,
  style,
}) => (
  <div
    style={{
      background: '#10141a',
      border: `2px solid ${color.line}`,
      borderRadius: 18,
      padding: '34px 42px',
      ...style,
    }}
  >
    {children}
  </div>
)

export const Kicker: React.FC<{ children: React.ReactNode; tone?: string }> = ({
  children,
  tone = color.dim,
}) => (
  <div
    style={{
      font: `800 24px/1 ${font.ui}`,
      letterSpacing: '0.18em',
      textTransform: 'uppercase',
      color: tone,
    }}
  >
    {children}
  </div>
)
