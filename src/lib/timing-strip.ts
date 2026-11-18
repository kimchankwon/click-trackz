import { clampLatency } from "@/settings/latency";

export const stripPosition = (ms: number, rangeMs: number) => (Math.min(rangeMs, Math.max(-rangeMs, ms)) + rangeMs) / (2 * rangeMs);

export function earlyLateText(ms: number, early: string, late: string, same: string): string {
  const rounded = Math.round(ms);
  if (rounded === 0) return same;
  return `${Math.abs(rounded)} ms ${rounded < 0 ? early : late}`;
}

export const stripKeySteps: Readonly<Record<string, number>> = { ArrowLeft: -1, ArrowRight: 1, ArrowDown: -1, ArrowUp: 1, PageUp: 10, PageDown: -10 };

export const nudgeAfterDrag = (startMs: number, dragX: number, width: number, rangeMs: number) =>
  width > 0 ? clampLatency(startMs - (dragX / width) * 2 * rangeMs) : clampLatency(startMs);
