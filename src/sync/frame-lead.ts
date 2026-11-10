export const FRAMES_AHEAD = 1.5;
export const FRAMES_PER_MEASURE = 15;

const ASSUMED_FRAME_MS = 1000 / 60;
const SHORTEST_FRAME_MS = 4;
const LONGEST_FRAME_MS = 40;

export function frameMsOf(gapsMs: readonly number[]): number {
  const steady = gapsMs.filter((gap) => gap >= SHORTEST_FRAME_MS && gap <= LONGEST_FRAME_MS).sort((a, b) => a - b);
  return steady.length === 0 ? ASSUMED_FRAME_MS : steady[Math.floor(steady.length / 2)];
}

export const drawLeadMs = (gapsMs: readonly number[]) => frameMsOf(gapsMs) * FRAMES_AHEAD;
