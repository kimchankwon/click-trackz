import { byBar, timeChangesProblem } from "@/sync/time-changes";
import { playsOf, type Section } from "@/sync/timeline";

import { MAX_SONG_TITLE } from "./copy-title";

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
  section.number === undefined ? null : (section.letter ?? null),
  section.bars,
  section.beatsPerBar,
  section.beatUnit ?? 4,
  section.bpm,
  section.voiceCueEnabled !== false,
  section.customLabel?.trim() || null,
  section.ownTempo === true,
  playsOf(section),
  byBar(section.timeChanges ?? []).map((change) => [change.bar, change.bars, change.beatsPerBar, change.beatUnit]),
];

const shapeOf = (draft: SongDraft) =>
  JSON.stringify([draft.title.trim(), draft.key.trim(), draft.countIn, draft.subdivision, draft.cueLeadBars, draft.bpm, draft.sections.map(sectionShape)]);

export const sameDraft = (a: SongDraft, b: SongDraft) => shapeOf(a) === shapeOf(b);

export const MAX_BARS = 64;
export const MAX_SECTIONS = 64;
export const MAX_KEY = 8;
export const MIN_BPM = 30;
export const MAX_BPM = 300;

const wholeBetween = (value: number, min: number, max: number) => Number.isInteger(value) && value >= min && value <= max;
const bpmOk = (bpm: number) => Number.isFinite(bpm) && bpm >= MIN_BPM && bpm <= MAX_BPM;

export function draftProblem(draft: Pick<SongDraft, "title" | "key" | "bpm" | "sections">): string | null {
  if (draft.title.trim().length === 0) return "Give the Song a title";
  if (draft.title.trim().length > MAX_SONG_TITLE) return `Song title must be ${MAX_SONG_TITLE} characters or fewer`;
  if (draft.key.trim().length > MAX_KEY) return `Key must be ${MAX_KEY} characters or fewer`;
  if (!bpmOk(draft.bpm)) return `Song tempo must be from ${MIN_BPM} to ${MAX_BPM} BPM`;
  if (draft.sections.length > MAX_SECTIONS) return `A Song can have at most ${MAX_SECTIONS} Sections`;
  for (const [index, section] of draft.sections.entries()) {
    const where = `Section ${index + 1}`;
    if (!wholeBetween(section.bars, 1, MAX_BARS)) return `${where}: Bars must be a whole number from 1 to ${MAX_BARS}`;
    if (section.ownTempo === true && !bpmOk(section.bpm)) return `${where}: BPM must be from ${MIN_BPM} to ${MAX_BPM}`;
    const timeProblem = timeChangesProblem(section);
    if (timeProblem) return `${where}: ${timeProblem}`;
  }
  return null;
}
