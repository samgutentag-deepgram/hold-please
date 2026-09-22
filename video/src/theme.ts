// The dashboard's tokens, lifted verbatim from src/web/public/index.html so a booth viewer
// who later walks past the live demo recognises the same screen. Do not invent colors here.

export const color = {
  bg: '#0b0d10',
  fg: '#f4f6f8',
  dim: '#8b949e',
  line: '#1f242b',
  listening: '#3fb950',
  thinking: '#f0b429',
  speaking: '#58a6ff',
  interrupted: '#f85149',
  idle: '#6e7681',
  caller: '#f4f6f8',
  agent: '#79c0ff',
} as const

export const font = {
  ui: 'system-ui, -apple-system, "Segoe UI", sans-serif',
  mono: 'ui-monospace, SFMono-Regular, Menlo, monospace',
} as const

export const FPS = 30
export const WIDTH = 1920
export const HEIGHT = 1080

/**
 * Vertical budget. The orientation strip is on every frame, so everything else lives in the
 * stage below it, and the dashboard takes whatever the caption band leaves.
 *
 * The strip costs the dashboard 72px it used to have. That is a real price for fidelity and
 * it is worth paying: at The Kinn a viewer arrives at a random frame, standing, from 15 feet,
 * with no audio, and a dashboard nobody can place is worth less than a smaller one they can.
 */
export const STRIP_H = 72
export const CAPTION_H = 176
export const STAGE_H = HEIGHT - STRIP_H
export const DASH_H = STAGE_H - CAPTION_H

export const sec = (s: number) => Math.round(s * FPS)
