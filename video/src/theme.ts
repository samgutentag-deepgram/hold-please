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

/** Height of the burned-in caption band. The dashboard gets whatever is left. */
export const CAPTION_H = 196

export const sec = (s: number) => Math.round(s * FPS)
