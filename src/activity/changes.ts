import { commonBpm, markOwnTempos } from "../sync/song-tempo";
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

export const sectionTypeName = (section: Pick<Section, "sectionType" | "number" | "letter">) =>
  section.number === undefined ? section.sectionType : `${section.sectionType} ${section.number}${section.letter ?? ""}`;

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

type Pairing = { kept: [number, number][]; moved: [number, number][]; removed: number[]; added: number[] };

function pairUp<T>(before: readonly T[], after: readonly T[], same: (a: T, b: T) => boolean, unchanged: (a: T, b: T) => boolean): Pairing {
  const perMatch = before.length + after.length + 1;
  const weight = (a: T, b: T) => (same(a, b) ? perMatch + (unchanged(a, b) ? 1 : 0) : 0);
  const scores = Array.from({ length: before.length + 1 }, () => new Array<number>(after.length + 1).fill(0));
  for (let i = before.length - 1; i >= 0; i--) {
    for (let j = after.length - 1; j >= 0; j--) {
      const w = weight(before[i], after[j]);
      scores[i][j] = Math.max(scores[i + 1][j], scores[i][j + 1], w > 0 ? w + scores[i + 1][j + 1] : 0);
    }
  }
  const kept: [number, number][] = [];
  let i = 0;
  let j = 0;
  while (i < before.length && j < after.length) {
    const w = weight(before[i], after[j]);
    if (w > 0 && scores[i][j] === w + scores[i + 1][j + 1]) kept.push([i++, j++]);
    else if (scores[i + 1][j] >= scores[i][j + 1]) i++;
    else j++;
  }
  const keptBefore = new Set(kept.map(([b]) => b));
  const keptAfter = new Set(kept.map(([, a]) => a));
  const removed = before.flatMap((item, b) => (keptBefore.has(b) ? [] : [b]));
  const added = after.flatMap((item, a) => (keptAfter.has(a) ? [] : [a]));
  const moved: [number, number][] = [];
  for (const fits of [unchanged, same]) {
    for (const a of [...added]) {
      const from = removed.find((b) => fits(before[b], after[a]));
      if (from === undefined) continue;
      moved.push([from, a]);
      removed.splice(removed.indexOf(from), 1);
      added.splice(added.indexOf(a), 1);
    }
  }
  moved.sort((x, y) => x[1] - y[1]);
  return { kept, moved, removed, added };
}

const sameSectionType = (a: ChangedSection, b: ChangedSection) => a.sectionType === b.sectionType && a.number === b.number && a.letter === b.letter;
const sameSection = (a: ChangedSection, b: ChangedSection) => sectionEdits(a, b).length === 0;

function sectionChanges(before: readonly ChangedSection[], after: readonly ChangedSection[]): string[] {
  const { kept, moved, removed, added } = pairUp(before, after, sameSectionType, sameSection);
  const lines: string[] = [];
  for (const i of removed) lines.push(`Removed Section ${i + 1}: ${sectionName(before[i])}`);
  for (const j of added) lines.push(`Added Section ${j + 1}: ${sectionName(after[j])}`);
  for (const [i, j] of moved) lines.push(`Moved ${sectionName(after[j])} from Section ${i + 1} to Section ${j + 1}`);
  for (const [i, j] of [...kept, ...moved].sort((a, b) => a[1] - b[1])) {
    for (const edit of sectionEdits(before[i], after[j])) lines.push(`Section ${j + 1} ${sectionName(after[j])}: ${edit}`);
  }
  return lines;
}

function inferredTempos(song: ChangedSong): ChangedSong {
  if (song.bpm !== undefined) return song;
  const bpm = commonBpm(song.sections);
  return bpm === null ? song : { ...song, bpm, sections: markOwnTempos(song.sections, bpm) };
}

export function songChanges(stored: ChangedSong, edited: ChangedSong): string[] {
  const before = inferredTempos(stored);
  const after = inferredTempos(edited);
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
  const sameEntry = (a: SetlistEntry, b: SetlistEntry) => sameSong(a, b) && orNone(a.key) === orNone(b.key) && orNone(a.leader) === orNone(b.leader);
  const { kept, moved, removed, added } = pairUp(before.entries, after.entries, sameSong, sameEntry);
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
