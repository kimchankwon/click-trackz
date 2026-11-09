import type { Beat } from "./timeline";

type ProgressBeat = Pick<Beat, "beatMs" | "passMs" | "msIntoPass">;

export function sectionProgressAt(beat: ProgressBeat) {
  if (beat.passMs <= 0) return { from: 0, to: 1 };
  return { from: beat.msIntoPass / beat.passMs, to: Math.min(1, (beat.msIntoPass + beat.beatMs) / beat.passMs) };
}

export function sectionProgressFrom(beat: ProgressBeat & Pick<Beat, "at">, nowMs: number | null) {
  const { from, to } = sectionProgressAt(beat);
  const elapsed = nowMs === null ? 0 : Math.min(Math.max(nowMs - beat.at, 0), beat.beatMs);
  const share = beat.beatMs > 0 ? elapsed / beat.beatMs : 1;
  return { start: from + (to - from) * share, to, durationMs: beat.beatMs - elapsed };
}
