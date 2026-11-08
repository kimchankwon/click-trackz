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
