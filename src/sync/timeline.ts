export type Section = {
  sectionType: string;
  number?: number;
  bars: number;
  beatsPerBar: number;
  beatUnit?: number;
  bpm: number;
  voiceCueEnabled?: boolean;
};

export const BEAT_UNITS = [2, 4, 8, 16] as const;

export const timeSignatureOf = (section: Pick<Section, "beatsPerBar" | "beatUnit">) => `${section.beatsPerBar}/${section.beatUnit ?? 4}`;

export function beatGroupSize(beatsPerBar: number, beatUnit = 4): number {
  return beatUnit >= 8 && beatsPerBar > 3 && beatsPerBar % 3 === 0 ? 3 : beatsPerBar;
}

export type Song = {
  countIn: boolean;
  subdivision?: number;
  cueLeadBars?: number;
  sections: readonly Section[];
};

export const CUE_LEAD_BARS = [1, 2] as const;

export const MAX_SPOKEN_COUNT = 8;

export const cueLeadBarsOf = (song: Pick<Song, "cueLeadBars">): number => (song.cueLeadBars === 1 ? 1 : 2);

export const SUBDIVISIONS = [1, 2, 3, 4] as const;

export const subdivisionOf = (song: Pick<Song, "subdivision">): number =>
  SUBDIVISIONS.find((n) => n === song.subdivision) ?? 1;

export const offbeatsOf = (beat: Pick<Beat, "at" | "beatMs">, subdivision: number): number[] =>
  Array.from({ length: Math.max(0, subdivision - 1) }, (_, index) => beat.at + ((index + 1) * beat.beatMs) / subdivision);

export type Jump = {
  at: number;
  toSection: number;
  cueFrom?: number;
  loop?: boolean;
};

export type Playback = {
  startsAt: number;
  startSection: number;
  startBar?: number;
  jumps?: readonly Jump[];
  stopsAt?: number | null;
};

export type VoiceCue = {
  sectionType: string;
  number?: number;
};

export type Lead = {
  cue: VoiceCue | null;
  barsLeft: number;
  beat: number;
  beats: number;
};

export type Beat = {
  at: number;
  count: string;
  beatInBar: number;
  beatsPerBar: number;
  beatUnit: number;
  beatMs: number;
  barInSection: number;
  barsInSection: number;
  sectionIndex: number | null;
  accent: boolean;
  groupStart: boolean;
  voiceCue: VoiceCue | null;
  spokenCount: number | null;
  lead: Lead | null;
};

export type AccentLevel = "bar" | "group" | "beat";

export const accentLevelOf = (beat: Pick<Beat, "accent" | "groupStart">): AccentLevel =>
  beat.accent ? "bar" : beat.groupStart ? "group" : "beat";

const labelOf = (section: Section) => `${section.sectionType.toUpperCase()}${section.number ?? ""}`;

type Bar = {
  startsAt: number;
  beatMs: number;
  beatsPerBar: number;
  beatUnit: number;
  section: Section | null;
  sectionIndex: number | null;
  barNumber: number;
  segmentEndsAt: number;
  cueFrom: number;
};

type Segment = {
  startsAt: number;
  startSection: number;
  startBar: number;
  countIn: boolean;
  cueFrom: number;
  loop: boolean;
  endsAt: number;
};

const beatMsOf = (section: Section) => 60_000 / section.bpm;

const barMsOf = (section: Section) => beatMsOf(section) * section.beatsPerBar;

const sectionMsOf = (section: Section) => barMsOf(section) * section.bars;

const longestOf = (song: Song, measure: (section: Section) => number) => song.sections.reduce((longest, section) => Math.max(longest, measure(section)), 0);

export const LOOKAHEAD_BARS = 3;

export function aheadWindowMs(song: Song): number {
  return longestOf(song, sectionMsOf) + LOOKAHEAD_BARS * longestOf(song, barMsOf);
}

function segmentsOf(song: Song, playback: Playback): Segment[] {
  const starts = [
    { startsAt: playback.startsAt, startSection: playback.startSection, startBar: playback.startBar ?? 1, countIn: song.countIn, cueFrom: -Infinity, loop: false },
    ...[...(playback.jumps ?? [])]
      .sort((x, y) => x.at - y.at)
      .map((jump) => ({ startsAt: jump.at, startSection: jump.toSection, startBar: 1, countIn: false, cueFrom: jump.cueFrom ?? -Infinity, loop: jump.loop === true })),
  ];
  return starts.map((start, index) => ({ ...start, endsAt: starts[index + 1]?.startsAt ?? Infinity }));
}

function loopBarsOf(song: Song, segment: Segment, untilMs: number): Bar[] {
  const section = song.sections[segment.startSection];
  if (section === undefined) return [];
  const limit = Math.min(segment.endsAt, untilMs);
  const stop = Number.isFinite(limit) ? limit : segment.startsAt + sectionMsOf(section);
  const beatMs = beatMsOf(section);
  const bars: Bar[] = [];
  let startsAt = segment.startsAt;
  while (startsAt < stop) {
    for (let barNumber = 1; barNumber <= section.bars && startsAt < stop; barNumber++) {
      bars.push({
        startsAt,
        beatMs,
        beatsPerBar: section.beatsPerBar,
        beatUnit: section.beatUnit ?? 4,
        section,
        sectionIndex: segment.startSection,
        barNumber,
        segmentEndsAt: segment.endsAt,
        cueFrom: segment.cueFrom,
      });
      startsAt += beatMs * section.beatsPerBar;
    }
  }
  return bars;
}

function barsOf(song: Song, segment: Segment, untilMs: number): Bar[] {
  if (segment.loop) return loopBarsOf(song, segment, untilMs);
  const sections = song.sections.slice(segment.startSection);
  const bars: Bar[] = [];
  let startsAt = segment.startsAt;
  const push = (section: Section, barSection: Section | null, sectionIndex: number | null, barNumber: number) => {
    if (startsAt >= segment.endsAt) return;
    const beatMs = beatMsOf(section);
    bars.push({
      startsAt,
      beatMs,
      beatsPerBar: section.beatsPerBar,
      beatUnit: section.beatUnit ?? 4,
      section: barSection,
      sectionIndex,
      barNumber,
      segmentEndsAt: segment.endsAt,
      cueFrom: segment.cueFrom,
    });
    startsAt += beatMs * section.beatsPerBar;
  };
  if (segment.countIn && sections.length > 0) for (let bar = 1; bar <= cueLeadBarsOf(song); bar++) push(sections[0], null, null, bar);
  sections.forEach((section, offset) => {
    const sectionIndex = segment.startSection + offset;
    for (let barNumber = offset === 0 ? segment.startBar : 1; barNumber <= section.bars; barNumber++) push(section, section, sectionIndex, barNumber);
  });
  return bars;
}

function countOf(bar: Bar, beat: number): string {
  if (beat > 1 || bar.section === null) return String(beat);
  return bar.barNumber === 1 ? labelOf(bar.section) : String(bar.barNumber);
}

const voiceCueOf = (section: Section): VoiceCue =>
  section.number === undefined
    ? { sectionType: section.sectionType }
    : { sectionType: section.sectionType, number: section.number };

const entersSection = (bars: readonly Bar[], index: number) => {
  const bar = bars[index];
  return bar?.section != null && (bar.barNumber === 1 || bars[index - 1]?.section === null);
};

const spacingOf = (bar: Bar, leadBars: number) => {
  const group = beatGroupSize(bar.beatsPerBar, bar.beatUnit);
  if (group < bar.beatsPerBar) return group;
  if (leadBars === 1) return 1;
  return bar.beatsPerBar % 2 === 0 ? 2 : bar.beatsPerBar;
};

const spokenEvery = (bar: Bar, leadBars: number, windowBars: number) => {
  let every = spacingOf(bar, leadBars);
  while (Math.ceil(bar.beatsPerBar / every) * windowBars > MAX_SPOKEN_COUNT) every += 1;
  return every;
};

type LeadBar = { target: number; first: number };

function leadBarsOf(bars: readonly Bar[], leadBars: number): Map<number, LeadBar> {
  const leads = new Map<number, LeadBar>();
  for (let target = 1; target <= bars.length; target++) {
    if (target < bars.length && !entersSection(bars, target)) continue;
    const first = leadBars > 1 && target >= 2 && !entersSection(bars, target - 1) ? target - 2 : target - 1;
    for (let index = first; index < target; index++) leads.set(index, { target, first });
  }
  return leads;
}

type BeatCue = { voiceCue: VoiceCue | null; spokenCount: number | null; lead: Lead };

function cuesOf(bars: readonly Bar[], { target, first }: LeadBar, leadBars: number): Map<string, BeatCue> {
  const section = bars[target]?.section ?? null;
  const cue = section ? voiceCueOf(section) : null;
  const speaks = section !== null && section.voiceCueEnabled !== false;
  const cueFrom = bars[target]?.cueFrom ?? -Infinity;
  const window = bars.slice(first, target);
  const beats = window.reduce((total, bar) => total + bar.beatsPerBar, 0);
  const cues = new Map<string, BeatCue>();
  let position = 0;
  let word = 0;
  let named = false;
  window.forEach((bar, offset) => {
    const every = spokenEvery(bar, leadBars, window.length);
    for (let beat = 1; beat <= bar.beatsPerBar; beat++) {
      position += 1;
      const onWord = speaks && (beat - 1) % every === 0;
      if (onWord) word += 1;
      const heard = onWord && bar.startsAt + (beat - 1) * bar.beatMs >= cueFrom;
      const saysName = heard && !named;
      if (saysName) named = true;
      cues.set(`${first + offset}:${beat}`, {
        voiceCue: saysName ? cue : null,
        spokenCount: heard && !saysName ? word : null,
        lead: { cue: section ? cue : null, barsLeft: target - (first + offset), beat: position, beats },
      });
    }
  });
  return cues;
}

export function beatsBetween(song: Song, playback: Playback, fromMs: number, toMs: number): Beat[] {
  const bars = barsOfPlayback(song, playback, toMs);
  const leadBars = cueLeadBarsOf(song);
  const leads = leadBarsOf(bars, leadBars);
  const cueWindows = new Map<number, Map<string, BeatCue>>();
  const cueFor = (index: number, beat: number): BeatCue | null => {
    const lead = leads.get(index);
    if (!lead) return null;
    let window = cueWindows.get(lead.target);
    if (!window) {
      window = cuesOf(bars, lead, leadBars);
      cueWindows.set(lead.target, window);
    }
    return window.get(`${index}:${beat}`) ?? null;
  };
  const beats: Beat[] = [];
  bars.forEach((bar, index) => {
    const groupSize = beatGroupSize(bar.beatsPerBar, bar.beatUnit);
    for (let beat = 1; beat <= bar.beatsPerBar; beat++) {
      const at = bar.startsAt + (beat - 1) * bar.beatMs;
      if (at >= bar.segmentEndsAt) break;
      const cue = cueFor(index, beat);
      beats.push({
        at,
        count: countOf(bar, beat),
        beatInBar: beat,
        beatsPerBar: bar.beatsPerBar,
        beatUnit: bar.beatUnit,
        beatMs: bar.beatMs,
        barInSection: bar.barNumber,
        barsInSection: bar.section?.bars ?? leadBars,
        sectionIndex: bar.sectionIndex,
        accent: beat === 1,
        groupStart: beat > 1 && (beat - 1) % groupSize === 0,
        voiceCue: cue?.voiceCue ?? null,
        spokenCount: cue?.spokenCount ?? null,
        lead: cue?.lead ?? null,
      });
    }
  });
  const endsAt = Math.min(toMs, playback.stopsAt ?? Infinity);
  return beats.filter((b) => b.at >= fromMs && b.at < endsAt);
}

export type CommandTiming = {
  nowMs: number;
  minLeadMs: number;
  mode: "nextBar" | "endOfSection";
};

const startsSection = (bar: Bar) => bar.section !== null && bar.barNumber === 1;

const barsOfPlayback = (song: Song, playback: Playback, untilMs = Infinity) => {
  const horizon = untilMs + LOOKAHEAD_BARS * longestOf(song, barMsOf);
  return segmentsOf(song, playback).flatMap((segment) => barsOf(song, segment, horizon));
};

function songEndOf(bars: readonly Bar[]): number | null {
  const last = bars.at(-1);
  return last ? last.startsAt + last.beatMs * last.beatsPerBar : null;
}

export function vampingSection(song: Song, playback: Playback): number | null {
  const last = segmentsOf(song, playback).at(-1);
  return last !== undefined && last.loop && song.sections[last.startSection] !== undefined ? last.startSection : null;
}

export function playbackEndsAt(song: Song, playback: Playback): number {
  if (vampingSection(song, playback) !== null) return playback.stopsAt ?? Infinity;
  return Math.min(songEndOf(barsOfPlayback(song, playback)) ?? playback.startsAt, playback.stopsAt ?? Infinity);
}

export function sectionIndexBefore(song: Song, playback: Playback, atMs: number): number | null {
  const bars = barsOfPlayback(song, playback, atMs);
  let found: Bar | null = null;
  for (const bar of bars) if (bar.startsAt < atMs) found = bar;
  return found?.sectionIndex ?? null;
}

export function commandBoundary(song: Song, playback: Playback, timing: CommandTiming): number | null {
  const earliest = timing.nowMs + timing.minLeadMs;
  const bars = barsOfPlayback(song, playback, earliest + longestOf(song, sectionMsOf));
  const songEndsAt = vampingSection(song, playback) === null ? songEndOf(bars) : null;
  const candidates = bars
    .filter((bar) => bar.section !== null && (timing.mode === "nextBar" || startsSection(bar)))
    .map((bar) => bar.startsAt);
  if (songEndsAt !== null) candidates.push(songEndsAt);
  const stopsAt = playback.stopsAt ?? Infinity;
  return candidates.find((at) => at > earliest && at < stopsAt) ?? null;
}
