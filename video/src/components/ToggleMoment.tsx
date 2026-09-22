import React from 'react'
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'
import { FPS, color, font } from '../theme.ts'

// The bit the whole video exists for. Every on-stage change is a toggle, so the video has to
// show the toggle move, at a size nobody can miss, with the proof strip underneath saying the
// socket never went away. A viewer who takes one thing from a booth loop should take this.

export type ToggleChange =
  | { kind: 'switch'; label: string; keyCap: string; from: boolean; to: boolean; danger?: boolean }
  | {
      kind: 'dial'
      label: string
      from: number
      to: number
      min: number
      max: number
      format: (v: number) => string
    }

const FLIP_AT = 1.1
const STAMP_AT = 1.9

const BigSwitch: React.FC<{ pos: number; danger?: boolean }> = ({ pos, danger }) => {
  const on = pos > 0.5
  const bg = on ? (danger ? color.interrupted : color.speaking) : '#2a3038'
  return (
    <div
      style={{
        position: 'relative',
        width: 296,
        height: 128,
        borderRadius: 999,
        background: bg,
        border: `8px solid ${on ? bg : color.line}`,
        flex: 'none',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 12,
          left: interpolate(pos, [0, 1], [12, 172]),
          width: 88,
          height: 88,
          borderRadius: '50%',
          background: on ? '#000' : color.dim,
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          [on ? 'left' : 'right']: 40,
          display: 'flex',
          alignItems: 'center',
          font: `900 30px/1 ${font.ui}`,
          letterSpacing: '0.1em',
          color: on ? '#000' : color.dim,
        }}
      >
        {on ? 'ON' : 'OFF'}
      </div>
    </div>
  )
}

const BigDial: React.FC<{ v: number; min: number; max: number; text: string }> = ({
  v,
  min,
  max,
  text,
}) => {
  const pos = ((v - min) / (max - min)) * 100
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 34 }}>
      <div style={{ position: 'relative', width: 480, height: 20, borderRadius: 999, background: '#2a3038' }}>
        <div
          style={{
            position: 'absolute',
            inset: '0 auto 0 0',
            width: `${pos}%`,
            borderRadius: 999,
            background: color.speaking,
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: `${pos}%`,
            width: 52,
            height: 52,
            margin: '-26px 0 0 -26px',
            borderRadius: '50%',
            background: color.speaking,
            border: '6px solid #000',
          }}
        />
      </div>
      <div
        style={{
          font: `800 62px/1 ${font.mono}`,
          color: color.fg,
          fontVariantNumeric: 'tabular-nums',
          minWidth: '5ch',
        }}
      >
        {text}
      </div>
    </div>
  )
}

export const ToggleMoment: React.FC<{ change: ToggleChange; proof: string[] }> = ({
  change,
  proof,
}) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  const enter = spring({ frame, fps, config: { damping: 200 }, durationInFrames: 14 })
  const travel = spring({
    frame: frame - FLIP_AT * FPS,
    fps,
    config: { damping: 14, mass: 0.6 },
    durationInFrames: 18,
  })
  const stamp = spring({
    frame: frame - STAMP_AT * FPS,
    fps,
    config: { damping: 200 },
    durationInFrames: 12,
  })

  const label = change.label
  const switchPos =
    change.kind === 'switch'
      ? (change.from ? 1 : 0) + ((change.to ? 1 : 0) - (change.from ? 1 : 0)) * travel
      : 0
  const dialV = change.kind === 'dial' ? interpolate(travel, [0, 1], [change.from, change.to]) : 0

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10,
      }}
    >
      <div style={{ position: 'absolute', inset: 0, background: '#000', opacity: enter * 0.68 }} />
      <div
        style={{
          position: 'relative',
          background: '#10141a',
          border: `3px solid ${color.line}`,
          borderRadius: 26,
          padding: '54px 74px',
          transform: `scale(${interpolate(enter, [0, 1], [0.92, 1])})`,
          opacity: enter,
          display: 'flex',
          flexDirection: 'column',
          gap: 34,
          alignItems: 'flex-start',
        }}
      >
        <div
          style={{
            font: `800 26px/1 ${font.ui}`,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: color.dim,
          }}
        >
          {change.kind === 'switch' ? 'One toggle. No code, no reconnect.' : 'One dial, on the open socket.'}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 40 }}>
          {change.kind === 'switch' ? (
            <BigSwitch pos={switchPos} danger={change.danger} />
          ) : (
            <BigDial v={dialV} min={change.min} max={change.max} text={change.format(dialV)} />
          )}
          <div style={{ font: `800 60px/1.05 ${font.ui}`, color: color.fg }}>
            {label}
            {change.kind === 'switch' ? (
              <span
                style={{
                  display: 'inline-block',
                  marginLeft: 22,
                  font: `700 26px/1 ${font.mono}`,
                  color: color.dim,
                  border: `2px solid ${color.line}`,
                  borderRadius: 8,
                  padding: '8px 14px',
                  verticalAlign: 'middle',
                }}
              >
                {change.keyCap}
              </span>
            ) : null}
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            gap: 18,
            flexWrap: 'wrap',
            opacity: stamp,
            transform: `translateY(${interpolate(stamp, [0, 1], [10, 0])}px)`,
          }}
        >
          {proof.map((p) => (
            <span
              key={p}
              style={{
                font: `800 24px/1 ${font.mono}`,
                letterSpacing: '0.04em',
                color: color.listening,
                border: `2px solid ${color.listening}`,
                borderRadius: 10,
                padding: '12px 18px',
              }}
            >
              {p}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
