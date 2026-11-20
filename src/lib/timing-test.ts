const WARM_UP_BEATS = 2;
export const MIN_TAPS = 6;
const MARK_HOLD = 0.25;

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

const OUTLIER_MS = 120;
const MIN_STEADY_TAPS = 4;

export type TapStep = { offsetsMs: readonly number[]; nudgeMs: number; intervalMs: number };

const median = (values: readonly number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  const half = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[half] : (sorted[half - 1] + sorted[half]) / 2;
};

function aroundTheirCentre(offsetsMs: readonly number[], intervalMs: number): number[] {
  const angles = offsetsMs.map((offset) => (offset / intervalMs) * 2 * Math.PI);
  const sin = angles.reduce((sum, angle) => sum + Math.sin(angle), 0);
  const cos = angles.reduce((sum, angle) => sum + Math.cos(angle), 0);
  const centre = (Math.atan2(sin, cos) / (2 * Math.PI)) * intervalMs;
  return offsetsMs.map((offset) => offset - Math.round((offset - centre) / intervalMs) * intervalMs);
}

export function steadyOffset(offsetsMs: readonly number[], intervalMs: number): number | null {
  if (offsetsMs.length < MIN_TAPS) return null;
  const unwrapped = aroundTheirCentre(offsetsMs, intervalMs);
  const rough = median(unwrapped);
  const steady = unwrapped.filter((offset) => Math.abs(offset - rough) <= OUTLIER_MS);
  return steady.length < MIN_STEADY_TAPS ? null : median(steady);
}

function heardAfterSending(step: TapStep): number | null {
  const offset = steadyOffset(step.offsetsMs, step.intervalMs);
  return offset === null ? null : offset + step.nudgeMs;
}

export function nudgeFromSteps(builtIn: TapStep, output: TapStep, builtInReportedMs: number): number | null {
  const onBuiltIn = heardAfterSending(builtIn);
  const onOutput = heardAfterSending(output);
  if (onBuiltIn === null || onOutput === null) return null;
  return Math.round(onOutput - onBuiltIn + builtInReportedMs);
}

export function markGrowth(phase: number, position: number): number {
  "worklet";
  if (phase < 0) return 0;
  const since = phase - position;
  return since >= 0 && since < MARK_HOLD ? 1 - since / MARK_HOLD : 0;
}
