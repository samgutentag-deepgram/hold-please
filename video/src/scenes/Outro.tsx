import React from 'react'
import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion'
import { color, font } from '../theme.ts'

// The booth card. This is the frame that is on screen when somebody finally looks up, so it
// carries the repo and nothing else that needs reading. Drop a QR PNG at public/qr.png and it
// appears; without one the URL stands on its own, which is fine at this size.

export const REPO = 'github.com/samgutentag-deepgram/hold-please'

export const Outro: React.FC<{ qr?: boolean }> = ({ qr = false }) => {
  const frame = useCurrentFrame()
  const { fps, durationInFrames } = useVideoConfig()
  const rise = (d: number) =>
    spring({ frame: frame - d, fps, config: { damping: 200 }, durationInFrames: 18 })
  // Fades to black so the loop seam is a cut to the title card, not a jump.
  const out = interpolate(frame, [durationInFrames - 18, durationInFrames], [1, 0], {
    extrapolateLeft: 'clamp',
  })

  return (
    <AbsoluteFill
      style={{
        background: color.bg,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 52,
        opacity: out,
      }}
    >
      <div
        style={{
          opacity: rise(0),
          font: `800 28px/1 ${font.ui}`,
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
          color: color.dim,
          textAlign: 'center',
        }}
      >
        Everything you just watched, including the switches
      </div>

      {qr ? (
        <Img
          src={staticFile('qr.png')}
          style={{
            width: 340,
            height: 340,
            borderRadius: 18,
            background: '#fff',
            padding: 18,
            opacity: rise(8),
          }}
        />
      ) : null}

      <div
        style={{
          opacity: rise(10),
          transform: `translateY(${interpolate(rise(10), [0, 1], [18, 0])}px)`,
          font: `800 62px/1.2 ${font.mono}`,
          color: color.fg,
          textAlign: 'center',
        }}
      >
        {REPO}
      </div>

      <div
        style={{
          opacity: rise(22),
          font: `600 38px/1.35 ${font.ui}`,
          color: color.dim,
          textAlign: 'center',
          maxWidth: 1320,
        }}
      >
        Built on Deepgram Flux and the Vonage Voice API. Both companies run a startup program;
        ask me about either one.
      </div>
    </AbsoluteFill>
  )
}
