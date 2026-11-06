import type { Beat } from "./timeline";

export function sectionProgressAt(beat: Pick<Beat, "beatInBar" | "beatsPerBar" | "barInSection" | "barsInSection">) {
  const total = beat.barsInSection * beat.beatsPerBar;
  const done = (beat.barInSection - 1) * beat.beatsPerBar + beat.beatInBar - 1;
  return { from: done / total, to: (done + 1) / total };
}

export function sectionProgressFrom(
  beat: Pick<Beat, "at" | "beatMs" | "beatInBar" | "beatsPerBar" | "barInSection" | "barsInSection">,
  nowMs: number | null,
) {
  const { from, to } = sectionProgressAt(beat);
  const elapsed = nowMs === null ? 0 : Math.min(Math.max(nowMs - beat.at, 0), beat.beatMs);
  const share = beat.beatMs > 0 ? elapsed / beat.beatMs : 1;
  return { start: from + (to - from) * share, to, durationMs: beat.beatMs - elapsed };
}
