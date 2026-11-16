export type ClockMapping = {
  audioMinusServerMs: number;
};

export function audioTimeFor(beatServerMs: number, mapping: ClockMapping, earlyByMs: number): number {
  return (beatServerMs + mapping.audioMinusServerMs - earlyByMs) / 1000;
}

const SNAP_BEYOND_MS = 50;
const MAX_STEP_MS = 1;

export const mappingSnaps = (current: ClockMapping | null, targetAudioMinusServerMs: number) =>
  current !== null && Math.abs(targetAudioMinusServerMs - current.audioMinusServerMs) > SNAP_BEYOND_MS;

export function slewMapping(current: ClockMapping | null, targetAudioMinusServerMs: number): ClockMapping {
  if (current === null) return { audioMinusServerMs: targetAudioMinusServerMs };
  if (mappingSnaps(current, targetAudioMinusServerMs)) return { audioMinusServerMs: targetAudioMinusServerMs };
  const gap = targetAudioMinusServerMs - current.audioMinusServerMs;
  const step = Math.max(-MAX_STEP_MS, Math.min(MAX_STEP_MS, gap));
  return { audioMinusServerMs: current.audioMinusServerMs + step };
}

export function scheduleTimeFor(beatServerMs: number, mapping: ClockMapping, latencyNudgeMs: number): number {
  return audioTimeFor(beatServerMs, mapping, latencyNudgeMs);
}
