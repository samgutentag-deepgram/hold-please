// The one clock. Every `t` on every DemoEvent comes from here and nowhere else.
// performance.now() is monotonic and measured from process start, so two events can always
// be subtracted safely. Date.now() is not allowed anywhere in the event path.

export const timeOrigin: number = performance.timeOrigin

export function now(): number {
  return Math.round(performance.now() * 10) / 10
}
