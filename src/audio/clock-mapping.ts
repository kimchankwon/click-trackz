export type ClockMapping = {
  audioMinusServerMs: number;
};

export function audioTimeFor(beatServerMs: number, mapping: ClockMapping, outputLatencyMs: number): number {
  return (beatServerMs + mapping.audioMinusServerMs - outputLatencyMs) / 1000;
}

const SNAP_BEYOND_MS = 50;
const MAX_STEP_MS = 1;

export function slewMapping(current: ClockMapping | null, targetAudioMinusServerMs: number): ClockMapping {
  if (current === null) return { audioMinusServerMs: targetAudioMinusServerMs };
  const gap = targetAudioMinusServerMs - current.audioMinusServerMs;
  if (Math.abs(gap) > SNAP_BEYOND_MS) return { audioMinusServerMs: targetAudioMinusServerMs };
  const step = Math.max(-MAX_STEP_MS, Math.min(MAX_STEP_MS, gap));
  return { audioMinusServerMs: current.audioMinusServerMs + step };
}

export function scheduleTimeFor(
  beatServerMs: number,
  mapping: ClockMapping,
  reportedLatencyMs: number,
  latencyNudgeMs: number,
): number {
  return audioTimeFor(beatServerMs, mapping, reportedLatencyMs + latencyNudgeMs);
}
