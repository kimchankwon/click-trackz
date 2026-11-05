export type TapRound = {
  tapOffsetsMs: readonly number[];
  reportedLatencyMs: number;
};

const OUTLIER_MS = 120;
const MIN_TAPS = 6;
const MIN_STEADY_TAPS = 4;

const median = (values: readonly number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
};

const steadyMedian = (offsets: readonly number[]): number | null => {
  if (offsets.length < MIN_TAPS) return null;
  const rough = median(offsets);
  const steady = offsets.filter((offset) => Math.abs(offset - rough) <= OUTLIER_MS);
  return steady.length < MIN_STEADY_TAPS ? null : median(steady);
};

export function calibrateLatency(speaker: TapRound, output: TapRound): number | null {
  const heardOnSpeaker = steadyMedian(speaker.tapOffsetsMs);
  const heardOnOutput = steadyMedian(output.tapOffsetsMs);
  if (heardOnSpeaker === null || heardOnOutput === null) return null;
  const extraHeard = heardOnOutput - heardOnSpeaker;
  const extraReported = output.reportedLatencyMs - speaker.reportedLatencyMs;
  return Math.round(extraHeard - extraReported);
}
