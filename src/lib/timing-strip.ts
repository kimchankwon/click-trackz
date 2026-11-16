export const stripPosition = (ms: number, rangeMs: number) => (Math.min(rangeMs, Math.max(-rangeMs, ms)) + rangeMs) / (2 * rangeMs);

export function earlyLateText(ms: number, early: string, late: string, same: string): string {
  const rounded = Math.round(ms);
  if (rounded === 0) return same;
  return `${Math.abs(rounded)} ms ${rounded < 0 ? early : late}`;
}
