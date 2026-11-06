export type Section = {
  sectionType: string;
  number?: number;
  bars: number;
  beatsPerBar: number;
  bpm: number;
  voiceCueEnabled?: boolean;
};

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

export type Beat = {
  at: number;
  count: string;
  beatInBar: number;
  beatsPerBar: number;
  sectionIndex: number | null;
  accent: boolean;
  voiceCue: VoiceCue | null;
  spokenCount: number | null;
};

const labelOf = (section: Section) => `${section.sectionType.toUpperCase()}${section.number ?? ""}`;

type Bar = {
  startsAt: number;
  beatMs: number;
  beatsPerBar: number;
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
      section: barSection,
      sectionIndex,
      barNumber,
      segmentEndsAt: segment.endsAt,
    });
    startsAt += beatMs * section.beatsPerBar;
  };
  if (segment.countIn && sections.length > 0) push(sections[0], null, null, 1);
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

function upcomingSection(bars: readonly Bar[], index: number): Section | null {
  const next = bars[index + 1];
  const entersSection = next?.barNumber === 1 || bars[index].section === null;
  if (!next?.section || !entersSection || next.section.voiceCueEnabled === false) return null;
  return next.section;
}

export function beatsBetween(song: Song, playback: Playback, fromMs: number, toMs: number): Beat[] {
  const bars = barsOfPlayback(song, playback);
  const beats: Beat[] = [];
  bars.forEach((bar, index) => {
    const upcoming = upcomingSection(bars, index);
    for (let beat = 1; beat <= bar.beatsPerBar; beat++) {
      const at = bar.startsAt + (beat - 1) * bar.beatMs;
      if (at >= bar.segmentEndsAt) break;
      beats.push({
        at,
        count: countOf(bar, beat),
        beatInBar: beat,
        beatsPerBar: bar.beatsPerBar,
        sectionIndex: bar.sectionIndex,
        accent: beat === 1,
        voiceCue: upcoming && beat === 1 ? voiceCueOf(upcoming) : null,
        spokenCount: upcoming && beat > 1 ? beat : null,
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
