export const TAP_RESET_MS = 2_000;
export const MAX_TAPS = 8;
export const TAP_MIN_BPM = 30;
export const TAP_MAX_BPM = 300;

export function addTap(taps: readonly number[], at: number): number[] {
  const last = taps.at(-1);
  const kept = last === undefined || at - last > TAP_RESET_MS || at <= last ? [] : taps;
  return [...kept, at].slice(-MAX_TAPS);
}

export function tappedBpm(taps: readonly number[]): number | null {
  if (taps.length < 2) return null;
  const spanMs = taps[taps.length - 1] - taps[0];
  if (spanMs <= 0) return null;
  const bpm = (60_000 * (taps.length - 1)) / spanMs;
  return Math.round(Math.min(TAP_MAX_BPM, Math.max(TAP_MIN_BPM, bpm)));
}
