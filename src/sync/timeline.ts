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
  sections: readonly Section[];
};

export type Jump = {
  at: number;
  toSection: number;
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

export const COUNT_IN_BARS = 2;

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
};

type Segment = {
  startsAt: number;
  startSection: number;
  startBar: number;
  countIn: boolean;
  endsAt: number;
};

const beatMsOf = (section: Section) => 60_000 / section.bpm;

function segmentsOf(song: Song, playback: Playback): Segment[] {
  const starts = [
    { startsAt: playback.startsAt, startSection: playback.startSection, startBar: playback.startBar ?? 1, countIn: song.countIn },
    ...[...(playback.jumps ?? [])]
      .sort((x, y) => x.at - y.at)
      .map((jump) => ({ startsAt: jump.at, startSection: jump.toSection, startBar: 1, countIn: false })),
  ];
  return starts.map((start, index) => ({ ...start, endsAt: starts[index + 1]?.startsAt ?? Infinity }));
}

function barsOf(song: Song, segment: Segment): Bar[] {
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
    });
    startsAt += beatMs * section.beatsPerBar;
  };
  if (segment.countIn && sections.length > 0) for (let bar = 1; bar <= COUNT_IN_BARS; bar++) push(sections[0], null, null, bar);
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

const spokenEvery = (bar: Bar) => {
  const group = beatGroupSize(bar.beatsPerBar, bar.beatUnit);
  if (group < bar.beatsPerBar) return group;
  return bar.beatsPerBar % 2 === 0 ? 2 : bar.beatsPerBar;
};

type LeadBar = { target: number; first: number };

function leadBarsOf(bars: readonly Bar[]): Map<number, LeadBar> {
  const leads = new Map<number, LeadBar>();
  for (let target = 1; target <= bars.length; target++) {
    if (target < bars.length && !entersSection(bars, target)) continue;
    const first = target >= 2 && !entersSection(bars, target - 1) ? target - 2 : target - 1;
    for (let index = first; index < target; index++) leads.set(index, { target, first });
  }
  return leads;
}

type BeatCue = { voiceCue: VoiceCue | null; spokenCount: number | null; lead: Lead };

function cuesOf(bars: readonly Bar[], { target, first }: LeadBar): Map<string, BeatCue> {
  const section = bars[target]?.section ?? null;
  const cue = section ? voiceCueOf(section) : null;
  const speaks = section !== null && section.voiceCueEnabled !== false;
  const window = bars.slice(first, target);
  const beats = window.reduce((total, bar) => total + bar.beatsPerBar, 0);
  const cues = new Map<string, BeatCue>();
  let position = 0;
  let spoken = 0;
  window.forEach((bar, offset) => {
    const every = spokenEvery(bar);
    for (let beat = 1; beat <= bar.beatsPerBar; beat++) {
      position += 1;
      const onWord = speaks && (beat - 1) % every === 0;
      if (onWord) spoken += 1;
      cues.set(`${first + offset}:${beat}`, {
        voiceCue: onWord && spoken === 1 ? cue : null,
        spokenCount: onWord && spoken > 1 ? spoken : null,
        lead: { cue: section ? cue : null, barsLeft: target - (first + offset), beat: position, beats },
      });
    }
  });
  return cues;
}

export function beatsBetween(song: Song, playback: Playback, fromMs: number, toMs: number): Beat[] {
  const bars = barsOfPlayback(song, playback);
  const leads = leadBarsOf(bars);
  const cueWindows = new Map<number, Map<string, BeatCue>>();
  const cueFor = (index: number, beat: number): BeatCue | null => {
    const lead = leads.get(index);
    if (!lead) return null;
    let window = cueWindows.get(lead.target);
    if (!window) {
      window = cuesOf(bars, lead);
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
        barsInSection: bar.section?.bars ?? COUNT_IN_BARS,
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

const barsOfPlayback = (song: Song, playback: Playback) => segmentsOf(song, playback).flatMap((segment) => barsOf(song, segment));

function songEndOf(bars: readonly Bar[]): number | null {
  const last = bars.at(-1);
  return last ? last.startsAt + last.beatMs * last.beatsPerBar : null;
}

export function playbackEndsAt(song: Song, playback: Playback): number {
  return Math.min(songEndOf(barsOfPlayback(song, playback)) ?? playback.startsAt, playback.stopsAt ?? Infinity);
}

export function commandBoundary(song: Song, playback: Playback, timing: CommandTiming): number | null {
  const earliest = timing.nowMs + timing.minLeadMs;
  const bars = barsOfPlayback(song, playback);
  const songEndsAt = songEndOf(bars);
  const candidates = bars
    .filter((bar) => timing.mode === "nextBar" || startsSection(bar))
    .map((bar) => bar.startsAt);
  if (songEndsAt !== null) candidates.push(songEndsAt);
  const stopsAt = playback.stopsAt ?? Infinity;
  return candidates.find((at) => at > earliest && at < stopsAt) ?? null;
}
