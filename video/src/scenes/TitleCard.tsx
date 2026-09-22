import React from 'react'
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'
import { color, font } from '../theme.ts'

/** The loop's opening card, and the thing a booth passer-by reads first. */
export const TitleCard: React.FC = () => {
  const frame = useCurrentFrame()
  const { fps, durationInFrames } = useVideoConfig()
  const rise = (d: number) =>
    spring({ frame: frame - d, fps, config: { damping: 200 }, durationInFrames: 18 })
  const out = interpolate(frame, [durationInFrames - 12, durationInFrames], [1, 0], {
    extrapolateLeft: 'clamp',
  })

  return (
    <AbsoluteFill
      style={{
        background: color.bg,
        justifyContent: 'center',
        padding: '0 120px',
        gap: 40,
        opacity: out,
      }}
    >
      <div
        style={{
          opacity: rise(0),
          font: `800 26px/1 ${font.ui}`,
          letterSpacing: '0.24em',
          textTransform: 'uppercase',
          color: color.dim,
        }}
      >
        Deepgram Flux &middot; Vonage Voice API &middot; a16z Tech Week 2026
      </div>
      <div
        style={{
          opacity: rise(8),
          transform: `translateY(${interpolate(rise(8), [0, 1], [26, 0])}px)`,
          font: `900 132px/1.02 ${font.ui}`,
          letterSpacing: '-0.025em',
          color: color.fg,
        }}
      >
        Your demo works.
        <br />
        <span style={{ color: color.interrupted }}>Your callers don&rsquo;t.</span>
      </div>
      <div
        style={{
          opacity: rise(20),
          font: `600 42px/1.3 ${font.ui}`,
          color: color.dim,
          maxWidth: 1380,
        }}
      >
        Four ways a real phone call breaks a voice agent, and four fixes applied mid-call on a
        socket that never closes.
      </div>
    </AbsoluteFill>
  )
}

/** The same card between beats, at a smaller weight. */
export const BeatTitle: React.FC<{ n: number; name: string; headline: string }> = ({
  n,
  name,
  headline,
}) => {
  const frame = useCurrentFrame()
  const { fps, durationInFrames } = useVideoConfig()
  const rise = (d: number) =>
    spring({ frame: frame - d, fps, config: { damping: 200 }, durationInFrames: 16 })
  const out = interpolate(frame, [durationInFrames - 10, durationInFrames], [1, 0], {
    extrapolateLeft: 'clamp',
  })

  return (
    <AbsoluteFill
      style={{ background: color.bg, justifyContent: 'center', padding: '0 120px', gap: 28, opacity: out }}
    >
      <div
        style={{
          opacity: rise(0),
          font: `900 30px/1 ${font.ui}`,
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
          color: color.speaking,
        }}
      >
        Beat {n}
      </div>
      <div
        style={{
          opacity: rise(6),
          transform: `translateY(${interpolate(rise(6), [0, 1], [20, 0])}px)`,
          font: `900 112px/1.05 ${font.ui}`,
          letterSpacing: '-0.02em',
          color: color.fg,
        }}
      >
        {name}
      </div>
      <div style={{ opacity: rise(14), font: `600 52px/1.25 ${font.ui}`, color: color.dim }}>
        {headline}
      </div>
    </AbsoluteFill>
  )
}
