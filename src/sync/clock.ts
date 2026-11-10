export type ClockSample = {
  sentAt: number;
  serverAt: number;
  receivedAt: number;
};

export type ClockEstimate = {
  offsetMs: number;
  uncertaintyMs: number;
  roundTripMs: number;
};

const roundTripOf = (sample: ClockSample) => sample.receivedAt - sample.sentAt;
const offsetOf = (sample: ClockSample) => sample.serverAt - (sample.sentAt + sample.receivedAt) / 2;

export const SLEEP_TOLERANCE_MS = 100;

export const clockSlept = (epochBefore: number, epochNow: number, toleranceMs = SLEEP_TOLERANCE_MS) => Math.abs(epochNow - epochBefore) > toleranceMs;

export const SAMPLE_WINDOW = 24;
export const MAX_SAMPLE_AGE_MS = 2 * 60_000;
export const NEAR_BEST_ROUND_TRIP_MS = 5;

export function estimateClockOffset(
  samples: readonly ClockSample[],
  maxAgeMs = MAX_SAMPLE_AGE_MS,
  nearBestMs = NEAR_BEST_ROUND_TRIP_MS,
): ClockEstimate | null {
  const newest = samples.reduce((latest, sample) => Math.max(latest, sample.receivedAt), -Infinity);
  const usable = samples.filter((sample) => roundTripOf(sample) >= 0 && newest - sample.receivedAt <= maxAgeMs);
  if (usable.length === 0) return null;
  const bestRoundTrip = usable.reduce((best, sample) => Math.min(best, roundTripOf(sample)), Infinity);
  const trusted = usable.filter((sample) => roundTripOf(sample) <= bestRoundTrip + nearBestMs);
  return {
    offsetMs: trusted.reduce((sum, sample) => sum + offsetOf(sample), 0) / trusted.length,
    uncertaintyMs: bestRoundTrip / 2,
    roundTripMs: bestRoundTrip,
  };
}
