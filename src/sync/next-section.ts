import type { Beat } from "./timeline";

const isSectionStart = (beat: Beat) => beat.sectionIndex !== null && beat.accent && !/^\d+$/.test(beat.count);

export function nextSectionIndex(ahead: readonly Beat[]): number | null {
  return ahead.find(isSectionStart)?.sectionIndex ?? null;
}
