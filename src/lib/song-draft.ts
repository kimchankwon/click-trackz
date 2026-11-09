import type { Section } from "@/sync/timeline";

type DraftSection = Section & { customLabel?: string; ownTempo?: boolean };

export type SongDraft = {
  title: string;
  key: string;
  countIn: boolean;
  subdivision: number;
  cueLeadBars: number;
  bpm: number;
  sections: readonly DraftSection[];
};

const sectionShape = (section: DraftSection) => [
  section.sectionType,
  section.number ?? null,
  section.bars,
  section.beatsPerBar,
  section.beatUnit ?? 4,
  section.bpm,
  section.voiceCueEnabled !== false,
  section.customLabel?.trim() || null,
  section.ownTempo === true,
];

const shapeOf = (draft: SongDraft) =>
  JSON.stringify([draft.title.trim(), draft.key.trim(), draft.countIn, draft.subdivision, draft.cueLeadBars, draft.bpm, draft.sections.map(sectionShape)]);

export const sameDraft = (a: SongDraft, b: SongDraft) => shapeOf(a) === shapeOf(b);

export const MAX_BARS = 64;
export const MIN_BPM = 30;
export const MAX_BPM = 300;

const wholeBetween = (value: number, min: number, max: number) => Number.isInteger(value) && value >= min && value <= max;
const bpmOk = (bpm: number) => Number.isFinite(bpm) && bpm >= MIN_BPM && bpm <= MAX_BPM;

export function draftProblem(draft: Pick<SongDraft, "title" | "bpm" | "sections">): string | null {
  if (draft.title.trim().length === 0) return "Give the Song a title";
  if (!bpmOk(draft.bpm)) return `Song tempo must be from ${MIN_BPM} to ${MAX_BPM} BPM`;
  for (const [index, section] of draft.sections.entries()) {
    const where = `Section ${index + 1}`;
    if (!wholeBetween(section.bars, 1, MAX_BARS)) return `${where}: Bars must be a whole number from 1 to ${MAX_BARS}`;
    if (section.ownTempo === true && !bpmOk(section.bpm)) return `${where}: BPM must be from ${MIN_BPM} to ${MAX_BPM}`;
  }
  return null;
}
