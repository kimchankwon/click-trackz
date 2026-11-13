import { cueLeadBarsOf, playsOf, subdivisionOf, type Section } from "../sync/timeline";

export type ChangedSection = Section & { customLabel?: string; ownTempo?: boolean };

export type ChangedSong = {
  title: string;
  key?: string;
  countIn: boolean;
  subdivision?: number;
  cueLeadBars?: number;
  bpm?: number;
  sections: readonly ChangedSection[];
};

export type SetlistEntry = { songId: string; key?: string; leader?: string };

export type ChangedSetlist = { name: string; entries: readonly SetlistEntry[] };

export const MAX_DETAILS = 20;

const onOff = (on: boolean) => (on ? "on" : "off");
const orNone = (value: string | undefined) => value?.trim() || "none";
const barsText = (bars: number) => (bars === 1 ? "1 bar" : `${bars} bars`);

export const sectionTypeName = (section: Pick<Section, "sectionType" | "number">) =>
  section.number === undefined ? section.sectionType : `${section.sectionType} ${section.number}`;

export const sectionName = (section: Pick<ChangedSection, "sectionType" | "number" | "customLabel">) =>
  section.customLabel?.trim() || sectionTypeName(section);

const meterOf = (section: Section) => `${section.beatsPerBar}/${section.beatUnit ?? 4}`;
const tempoOf = (section: ChangedSection) => (section.ownTempo === true ? `${section.bpm} BPM` : "Song tempo");
const timeChangesOf = (section: Section) =>
  (section.timeChanges ?? [])
    .map((change) => `${change.beatsPerBar}/${change.beatUnit} at bar ${change.bar} for ${barsText(change.bars)}`)
    .join(", ") || "none";

const change = (what: string, before: string, after: string) => (before === after ? [] : [`${what}: ${before} → ${after}`]);

function sectionEdits(before: ChangedSection, after: ChangedSection): string[] {
  return [
    ...change("Section type", sectionTypeName(before), sectionTypeName(after)),
    ...change("Custom label", orNone(before.customLabel), orNone(after.customLabel)),
    ...change("Bars", String(before.bars), String(after.bars)),
    ...change("Time signature", meterOf(before), meterOf(after)),
    ...change("Tempo", tempoOf(before), tempoOf(after)),
    ...change("Voice cue", onOff(before.voiceCueEnabled !== false), onOff(after.voiceCueEnabled !== false)),
    ...change("Plays", String(playsOf(before)), String(playsOf(after))),
    ...change("Time changes", timeChangesOf(before), timeChangesOf(after)),
  ];
}

function matchInOrder<T>(before: readonly T[], after: readonly T[], same: (a: T, b: T) => boolean): [number, number][] {
  const lengths = Array.from({ length: before.length + 1 }, () => new Array<number>(after.length + 1).fill(0));
  for (let i = before.length - 1; i >= 0; i--) {
    for (let j = after.length - 1; j >= 0; j--) {
      lengths[i][j] = same(before[i], after[j]) ? lengths[i + 1][j + 1] + 1 : Math.max(lengths[i + 1][j], lengths[i][j + 1]);
    }
  }
  const pairs: [number, number][] = [];
  let i = 0;
  let j = 0;
  while (i < before.length && j < after.length) {
    if (same(before[i], after[j])) pairs.push([i++, j++]);
    else if (lengths[i + 1][j] >= lengths[i][j + 1]) i++;
    else j++;
  }
  return pairs;
}

const sameSectionType = (a: ChangedSection, b: ChangedSection) => a.sectionType === b.sectionType && a.number === b.number;

function sectionChanges(before: readonly ChangedSection[], after: readonly ChangedSection[]): string[] {
  const kept = matchInOrder(before, after, sameSectionType);
  const keptBefore = new Set(kept.map(([i]) => i));
  const keptAfter = new Set(kept.map(([, j]) => j));
  const removed = before.flatMap((section, i) => (keptBefore.has(i) ? [] : [i]));
  const added = after.flatMap((section, j) => (keptAfter.has(j) ? [] : [j]));
  const moved: [number, number][] = [];
  for (const j of [...added]) {
    const from = removed.find((i) => sameSectionType(before[i], after[j]));
    if (from === undefined) continue;
    moved.push([from, j]);
    removed.splice(removed.indexOf(from), 1);
    added.splice(added.indexOf(j), 1);
  }
  const lines: string[] = [];
  for (const i of removed) lines.push(`Removed Section ${i + 1}: ${sectionName(before[i])}`);
  for (const j of added) lines.push(`Added Section ${j + 1}: ${sectionName(after[j])}`);
  for (const [i, j] of moved) lines.push(`Moved ${sectionName(after[j])} from Section ${i + 1} to Section ${j + 1}`);
  for (const [i, j] of [...kept, ...moved].sort((a, b) => a[1] - b[1])) {
    for (const edit of sectionEdits(before[i], after[j])) lines.push(`Section ${j + 1} ${sectionName(after[j])}: ${edit}`);
  }
  return lines;
}

export function songChanges(before: ChangedSong, after: ChangedSong): string[] {
  const songTempo = (song: ChangedSong) => (song.bpm === undefined ? "none" : `${song.bpm} BPM`);
  return [
    ...change("Title", before.title, after.title),
    ...change("Key", orNone(before.key), orNone(after.key)),
    ...change("Song tempo", songTempo(before), songTempo(after)),
    ...change("Count-in", onOff(before.countIn), onOff(after.countIn)),
    ...change("Clicks per beat", String(subdivisionOf(before)), String(subdivisionOf(after))),
    ...change("Cue lead", barsText(cueLeadBarsOf(before)), barsText(cueLeadBarsOf(after))),
    ...sectionChanges(before.sections, after.sections),
  ];
}

export function setlistChanges(before: ChangedSetlist, after: ChangedSetlist, titleOf: (songId: string) => string): string[] {
  const lines = change("Name", before.name, after.name);
  const sameSong = (a: SetlistEntry, b: SetlistEntry) => a.songId === b.songId;
  const kept = matchInOrder(before.entries, after.entries, sameSong);
  const keptBefore = new Set(kept.map(([i]) => i));
  const keptAfter = new Set(kept.map(([, j]) => j));
  const removed = before.entries.flatMap((entry, i) => (keptBefore.has(i) ? [] : [i]));
  const added = after.entries.flatMap((entry, j) => (keptAfter.has(j) ? [] : [j]));
  const moved: [number, number][] = [];
  for (const j of [...added]) {
    const from = removed.find((i) => sameSong(before.entries[i], after.entries[j]));
    if (from === undefined) continue;
    moved.push([from, j]);
    removed.splice(removed.indexOf(from), 1);
    added.splice(added.indexOf(j), 1);
  }
  for (const i of removed) lines.push(`Removed ${titleOf(before.entries[i].songId)}`);
  for (const j of added) lines.push(`Added ${titleOf(after.entries[j].songId)} as number ${j + 1}`);
  for (const [, j] of moved) lines.push(`Moved ${titleOf(after.entries[j].songId)} to number ${j + 1}`);
  for (const [i, j] of [...kept, ...moved].sort((a, b) => a[1] - b[1])) {
    const title = titleOf(after.entries[j].songId);
    const was = before.entries[i];
    const now = after.entries[j];
    for (const edit of [...change("Key", orNone(was.key), orNone(now.key)), ...change("Leader", orNone(was.leader), orNone(now.leader))]) {
      lines.push(`${title}: ${edit}`);
    }
  }
  return lines;
}

export function capDetails(lines: readonly string[]): string[] {
  if (lines.length <= MAX_DETAILS) return [...lines];
  const more = lines.length - (MAX_DETAILS - 1);
  return [...lines.slice(0, MAX_DETAILS - 1), `And ${more} more changes`];
}
