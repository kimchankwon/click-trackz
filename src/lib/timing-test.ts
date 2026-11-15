export const WARM_UP_BEATS = 2;
export const MIN_TAPS = 4;
export const MARK_HOLD = 0.25;

export function beatPhase(nowMs: number, firstBeatAt: number, intervalMs: number): number {
  const fromStart = (nowMs - firstBeatAt) / intervalMs + 0.5;
  if (fromStart < 0) return -1;
  return fromStart - Math.floor(fromStart);
}

export function offsetFromBeat(atMs: number, firstBeatAt: number, intervalMs: number): number | null {
  const index = Math.round((atMs - firstBeatAt) / intervalMs);
  if (index < WARM_UP_BEATS) return null;
  return atMs - (firstBeatAt + index * intervalMs);
}

export function nudgeFromTaps(currentNudgeMs: number, offsetsMs: readonly number[]): number | null {
  if (offsetsMs.length < MIN_TAPS) return null;
  const sorted = [...offsetsMs].sort((a, b) => a - b);
  const half = Math.floor(sorted.length / 2);
  const middle = sorted.length % 2 === 1 ? sorted[half] : (sorted[half - 1] + sorted[half]) / 2;
  return Math.round(currentNudgeMs + middle);
}

export function markGrowth(phase: number, position: number): number {
  "worklet";
  if (phase < 0) return 0;
  const since = phase - position;
  return since >= 0 && since < MARK_HOLD ? 1 - since / MARK_HOLD : 0;
}
