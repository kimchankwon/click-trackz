import type { Beat } from "./timeline";

export function sectionProgressAt(beat: Pick<Beat, "beatInBar" | "beatsPerBar" | "barInSection" | "barsInSection">) {
  const total = beat.barsInSection * beat.beatsPerBar;
  const done = (beat.barInSection - 1) * beat.beatsPerBar + beat.beatInBar - 1;
  return { from: done / total, to: (done + 1) / total };
}
