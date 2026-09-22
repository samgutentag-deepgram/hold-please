import React from 'react'
import { interpolate, useCurrentFrame } from 'remotion'
import { CAPTION_H, FPS, color, font } from '../theme.ts'

// The video is silent by design: it plays behind a talk and on a booth screen where nobody
// can hear it. The caption band carries the whole voiceover, so it is sized to be read from
// 15 feet, same test as the dashboard itself.

export interface Cue {
  /** Seconds from the start of the scene. */
  at: number
  text: string
  /** Optional lead-in in smaller type, for naming the beat step. */
  kicker?: string
  tone?: 'neutral' | 'bad' | 'good'
}

const toneColor = { neutral: color.fg, bad: color.interrupted, good: color.listening } as const

export const CaptionBand: React.FC<{ cues: Cue[] }> = ({ cues }) => {
  const frame = useCurrentFrame()
  const t = frame / FPS

  let active = -1
  for (let i = 0; i < cues.length; i++) if (cues[i].at <= t) active = i
  const cue = active >= 0 ? cues[active] : null
  const since = cue ? t - cue.at : 0
  const opacity = interpolate(since, [0, 0.25], [0, 1], { extrapolateRight: 'clamp' })

  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height: CAPTION_H,
        // Above the toggle overlay's dimming layer: the caption is what explains the overlay.
        zIndex: 20,
        background: '#05070a',
        borderTop: `2px solid ${color.line}`,
        // Extra room on the right: the beat's state chip parks there.
        padding: '22px 460px 22px 56px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        gap: 10,
      }}
    >
      {cue ? (
        <div style={{ opacity }}>
          {cue.kicker ? (
            <div
              style={{
                font: `800 22px/1 ${font.ui}`,
                letterSpacing: '0.16em',
                textTransform: 'uppercase',
                color: toneColor[cue.tone ?? 'neutral'],
                marginBottom: 14,
              }}
            >
              {cue.kicker}
            </div>
          ) : null}
          <div
            style={{
              font: `700 46px/1.2 ${font.ui}`,
              color: color.fg,
              textWrap: 'balance',
            }}
          >
            {cue.text}
          </div>
        </div>
      ) : null}
    </div>
  )
}
