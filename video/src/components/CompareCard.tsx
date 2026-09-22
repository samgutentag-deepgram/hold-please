import React from 'react'
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'
import { color, font } from '../theme.ts'

// The still that does the arguing. The dashboard scenes are motion, and motion is bad at
// "same input, two different outputs". This is text, frozen, stacked, and large enough that
// somebody walking past a booth gets the whole beat in two seconds without reading captions.

export interface Side {
  label: string
  text: string
  note?: string
}

export const CompareCard: React.FC<{
  title: string
  said: string
  before: Side
  after: Side
  footnote?: string
}> = ({ title, said, before, after, footnote }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const row = (i: number) =>
    spring({ frame: frame - 8 - i * 9, fps, config: { damping: 200 }, durationInFrames: 14 })

  const Row: React.FC<{ side: Side; tone: string; i: number }> = ({ side, tone, i }) => {
    const s = row(i)
    return (
      <div
        style={{
          opacity: s,
          transform: `translateY(${interpolate(s, [0, 1], [24, 0])}px)`,
          borderLeft: `10px solid ${tone}`,
          background: '#10141a',
          borderRadius: '0 16px 16px 0',
          padding: '30px 40px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          gap: 14,
          // Both halves take the same vertical space whatever the copy length, so the card
          // reads as a balanced comparison rather than one side looking like a footnote.
          flex: 1,
        }}
      >
        <div
          style={{
            font: `900 24px/1 ${font.ui}`,
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            color: tone,
          }}
        >
          {side.label}
        </div>
        <div style={{ font: `700 66px/1.1 ${font.ui}`, color: color.fg, textWrap: 'balance' }}>
          {side.text}
        </div>
        {side.note ? (
          <div style={{ font: `600 28px/1.3 ${font.ui}`, color: color.dim }}>{side.note}</div>
        ) : null}
      </div>
    )
  }

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: color.bg,
        padding: '56px 72px',
        display: 'flex',
        flexDirection: 'column',
        gap: 26,
      }}
    >
      <div
        style={{
          font: `800 28px/1 ${font.ui}`,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: color.dim,
        }}
      >
        {title}
      </div>
      <div style={{ font: `600 40px/1.25 ${font.ui}`, color: color.dim }}>
        Caller said, both times:{' '}
        <span style={{ color: color.fg, fontWeight: 800 }}>&ldquo;{said}&rdquo;</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 22, flex: 1 }}>
        <Row side={before} tone={color.interrupted} i={0} />
        <Row side={after} tone={color.listening} i={1} />
      </div>
      {footnote ? (
        <div style={{ font: `600 30px/1.3 ${font.ui}`, color: color.dim, opacity: row(2) }}>
          {footnote}
        </div>
      ) : null}
    </div>
  )
}
