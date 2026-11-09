import type { Beat } from "./timeline";

export type SectionStart = { sectionIndex: number; pass: number; passes: number };

const isSectionStart = (beat: Beat) => beat.sectionIndex !== null && beat.accent && !/^\d+$/.test(beat.count);

export function nextSectionStart(ahead: readonly Beat[]): SectionStart | null {
  const start = ahead.find(isSectionStart);
  return start?.sectionIndex == null ? null : { sectionIndex: start.sectionIndex, pass: start.passInSection, passes: start.passesInSection };
}
