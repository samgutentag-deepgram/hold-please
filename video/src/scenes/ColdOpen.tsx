import React from 'react'
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion'
import { Dashboard } from '../components/Dashboard.tsx'
import { beat1 } from '../fixtures/beats.ts'
import { replay } from '../replay.ts'
import { DASH_H, FPS, color, sec } from '../theme.ts'

// Six seconds of the thing going wrong, with nothing explaining it.
//
// The loop used to open on a static title card, which is the weakest hook in the video: at a
// booth you have about two seconds before someone's eyes move on. So it opens instead on the
// agent talking straight over the caller. No caption, no chip, no orientation strip. Somebody
// walking past sees a failure before they see a title, and the title then answers a question
// they are already asking.
//
// It reuses beat 1's timeline rather than a fixture of its own, so there is exactly one
// account of what the barge-in failure looks like and the cold open cannot drift from it.

export const COLD_OPEN_S = 6

/** Where in beat 1 the failure is already underway: the caller has cut in and been ignored. */
const ENTER_AT_MS = 4600

export const ColdOpen: React.FC = () => {
  const frame = useCurrentFrame()
  const state = replay(beat1.events, ENTER_AT_MS + (frame / FPS) * 1000, {})

  // Matches the outro's fade-out so the loop seam reads as one dissolve through the
  // background rather than a cut from a faded frame to a solid one.
  const seam = interpolate(frame, [0, 12], [0, 1], { extrapolateRight: 'clamp' })

  return (
    <AbsoluteFill style={{ background: color.bg, opacity: seam }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: DASH_H }}>
        <Dashboard state={state} height={DASH_H} />
      </div>
    </AbsoluteFill>
  )
}

export const coldOpenDuration = () => sec(COLD_OPEN_S)
