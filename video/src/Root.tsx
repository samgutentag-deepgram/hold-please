import React from 'react'
import { Composition } from 'remotion'
import { BEATS, ORDER_SWAPPED } from './fixtures/beats.ts'
import { Beat, beatDuration } from './scenes/Beat.tsx'
import { Master, MasterSwapped, masterDuration } from './scenes/Master.tsx'
import { FPS, HEIGHT, WIDTH } from './theme.ts'

// `master` is the booth loop. The four `beat-*` compositions are the same frames, rendered on
// their own, so a beat that dies on stage can be cut to without playing the whole video. Same
// source either way, which is the only way they stay in sync.

export const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id="master"
      component={Master}
      durationInFrames={masterDuration()}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
    />
    <Composition
      id="master-swapped"
      component={MasterSwapped}
      durationInFrames={masterDuration(ORDER_SWAPPED)}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
    />
    {BEATS.map((spec) => (
      <Composition
        key={spec.id}
        id={`beat-${spec.id}`}
        component={Beat}
        defaultProps={{ spec }}
        durationInFrames={beatDuration(spec)}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
    ))}
  </>
)
