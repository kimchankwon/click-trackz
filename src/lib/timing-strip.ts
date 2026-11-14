const RANGES_MS = [50, 100, 150, 200, 300, 400, 500, 600, 800] as const;

export function stripRangeMs(values: readonly number[]): number {
  const widest = values.reduce((most, value) => Math.max(most, Math.abs(value)), 0) * 1.25;
  return RANGES_MS.find((range) => range >= widest) ?? RANGES_MS[RANGES_MS.length - 1];
}

export const stripPosition = (ms: number, rangeMs: number) => (Math.min(rangeMs, Math.max(-rangeMs, ms)) + rangeMs) / (2 * rangeMs);

export function middleOf(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const half = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[half] : (sorted[half - 1] + sorted[half]) / 2;
}

export function earlyLateText(ms: number, early: string, late: string, same: string): string {
  const rounded = Math.round(ms);
  if (rounded === 0) return same;
  return `${Math.abs(rounded)} ms ${rounded < 0 ? early : late}`;
}
