export type Section = {
  sectionType: string;
  number?: number;
  bars: number;
  beatsPerBar: number;
  beatUnit?: number;
  bpm: number;
  voiceCueEnabled?: boolean;
  plays?: number;
  timeChanges?: TimeChange[];
};

export type TimeChange = {
  bar: number;
  bars: number;
  beatsPerBar: number;
  beatUnit: number;
};

export const MAX_TIME_CHANGES = 8;

export const MAX_PLAYS = 16;

export const playsOf = (section: Pick<Section, "plays">): number =>
  section.plays !== undefined && Number.isInteger(section.plays) && section.plays > 1 ? Math.min(section.plays, MAX_PLAYS) : 1;

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
  vamp?: boolean;
  pass?: number;
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
  pass: number;
  passes: number;
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
  passInSection: number;
  passesInSection: number;
  passMs: number;
  msIntoPass: number;
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
  pass: number;
  passes: number;
  repeatsPass: boolean;
  passMs: number;
  msIntoPass: number;
  segmentEndsAt: number;
  cueFrom: number;
};

type Segment = {
  startsAt: number;
  startSection: number;
  startBar: number;
  startPass: number;
  countIn: boolean;
  cueFrom: number;
  vamp: boolean;
  endsAt: number;
};

export type Meter = { beatsPerBar: number; beatUnit: number; beatMs: number };

const beatMsOf = (section: Section) => 60_000 / section.bpm;

const mainMeterOf = (section: Section): Meter => ({ beatsPerBar: section.beatsPerBar, beatUnit: section.beatUnit ?? 4, beatMs: beatMsOf(section) });

const changedMeterOf = (section: Section, change: TimeChange): Meter => ({
  beatsPerBar: change.beatsPerBar,
  beatUnit: change.beatUnit,
  beatMs: (beatMsOf(section) * (section.beatUnit ?? 4)) / change.beatUnit,
});

const changeAt = (section: Section, barNumber: number) => section.timeChanges?.find((change) => barNumber >= change.bar && barNumber < change.bar + change.bars);

export function meterOf(section: Section, barNumber: number): Meter {
  const change = changeAt(section, barNumber);
  return change ? changedMeterOf(section, change) : mainMeterOf(section);
}

const msOf = (meter: Meter) => meter.beatMs * meter.beatsPerBar;

const longestBarMsOf = (section: Section) =>
  Math.max(msOf(mainMeterOf(section)), ...(section.timeChanges ?? []).map((change) => msOf(changedMeterOf(section, change))));

function msBeforeBar(section: Section, barNumber: number): number {
  if (!section.timeChanges?.length) return (barNumber - 1) * msOf(mainMeterOf(section));
  let total = 0;
  for (let bar = 1; bar < barNumber; bar++) total += msOf(meterOf(section, bar));
  return total;
}

const sectionMsOf = (section: Section) => msBeforeBar(section, section.bars + 1);

const longestOf = (song: Song, measure: (section: Section) => number) => song.sections.reduce((longest, section) => Math.max(longest, measure(section)), 0);

export const longestBeatMs = (song: Song) =>
  longestOf(song, (section) => Math.max(beatMsOf(section), ...(section.timeChanges ?? []).map((change) => changedMeterOf(section, change).beatMs)));

export const LOOKAHEAD_BARS = 3;

const VAMP_PASSES_KEPT_BEHIND = 2;

const BARS_KEPT_BEHIND = 4;

export function aheadWindowMs(song: Song): number {
  return longestOf(song, sectionMsOf) + LOOKAHEAD_BARS * longestOf(song, longestBarMsOf);
}

function segmentsOf(song: Song, playback: Playback): Segment[] {
  const starts = [
    { startsAt: playback.startsAt, startSection: playback.startSection, startBar: playback.startBar ?? 1, startPass: 1, countIn: song.countIn, cueFrom: -Infinity, vamp: false },
    ...[...(playback.jumps ?? [])]
      .sort((x, y) => x.at - y.at)
      .map((jump) => ({
        startsAt: jump.at,
        startSection: jump.toSection,
        startBar: 1,
        startPass: jump.pass ?? 1,
        countIn: false,
        cueFrom: jump.cueFrom ?? -Infinity,
        vamp: jump.vamp === true,
      })),
  ];
  return starts.map((start, index) => ({ ...start, endsAt: starts[index + 1]?.startsAt ?? Infinity }));
}

function vampBarsOf(song: Song, segment: Segment, fromMs: number, untilMs: number): Bar[] {
  const section = song.sections[segment.startSection];
  if (section === undefined) return [];
  const passMs = sectionMsOf(section);
  const limit = Math.min(segment.endsAt, untilMs);
  const stop = Number.isFinite(limit) ? limit : segment.startsAt + passMs;
  const firstPass = Math.max(0, Math.floor((fromMs - segment.startsAt) / passMs) - VAMP_PASSES_KEPT_BEHIND);
  const bars: Bar[] = [];
  for (let pass = firstPass; segment.startsAt + pass * passMs < stop; pass++) {
    const passStartsAt = segment.startsAt + pass * passMs;
    let msIntoPass = 0;
    for (let barNumber = 1; barNumber <= section.bars; barNumber++) {
      const startsAt = passStartsAt + msIntoPass;
      if (startsAt >= stop) break;
      const meter = meterOf(section, barNumber);
      bars.push({
        startsAt,
        beatMs: meter.beatMs,
        beatsPerBar: meter.beatsPerBar,
        beatUnit: meter.beatUnit,
        section,
        sectionIndex: segment.startSection,
        barNumber,
        pass: 1,
        passes: 1,
        repeatsPass: false,
        passMs,
        msIntoPass,
        segmentEndsAt: segment.endsAt,
        cueFrom: segment.cueFrom,
      });
      msIntoPass += msOf(meter);
    }
  }
  return bars;
}

function barsOf(song: Song, segment: Segment, fromMs: number, untilMs: number): Bar[] {
  if (segment.vamp) return vampBarsOf(song, segment, fromMs, untilMs);
  const sections = song.sections.slice(segment.startSection);
  const stop = Math.min(segment.endsAt, untilMs);
  const behind: Bar[] = [];
  const current: Bar[] = [];
  const bars = () => [...behind, ...current];
  let startsAt = segment.startsAt;
  const push = (meter: Meter, place: Pick<Bar, "section" | "sectionIndex" | "barNumber" | "pass" | "passes" | "repeatsPass" | "passMs" | "msIntoPass">) => {
    const bar = { startsAt, ...meter, ...place, segmentEndsAt: segment.endsAt, cueFrom: segment.cueFrom };
    startsAt += msOf(meter);
    if (current.length > 0 || startsAt > fromMs) current.push(bar);
    else if (behind.push(bar) > BARS_KEPT_BEHIND) behind.shift();
  };
  if (segment.countIn && sections.length > 0) {
    const meter = mainMeterOf(sections[0]);
    const leadBars = cueLeadBarsOf(song);
    for (let bar = 1; bar <= leadBars && startsAt < stop; bar++) {
      push(meter, { section: null, sectionIndex: null, barNumber: bar, pass: 1, passes: 1, repeatsPass: false, passMs: leadBars * msOf(meter), msIntoPass: (bar - 1) * msOf(meter) });
    }
  }
  for (const [offset, section] of sections.entries()) {
    const sectionIndex = segment.startSection + offset;
    const passes = playsOf(section);
    const passMs = sectionMsOf(section);
    const firstPass = offset === 0 ? Math.min(Math.max(1, segment.startPass), passes) : 1;
    for (let pass = firstPass; pass <= passes; pass++) {
      const firstBar = offset === 0 && pass === firstPass ? segment.startBar : 1;
      let msIntoPass = msBeforeBar(section, firstBar);
      for (let barNumber = firstBar; barNumber <= section.bars; barNumber++) {
        if (startsAt >= stop) return bars();
        const meter = meterOf(section, barNumber);
        push(meter, { section, sectionIndex, barNumber, pass, passes, repeatsPass: pass > firstPass, passMs, msIntoPass });
        msIntoPass += msOf(meter);
      }
    }
  }
  return bars();
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
  return bar?.section != null && !bar.repeatsPass && (bar.barNumber === 1 || bars[index - 1]?.section === null);
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
  const pass = bars[target]?.pass ?? 1;
  const passes = bars[target]?.passes ?? 1;
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
        lead: { cue: section ? cue : null, barsLeft: target - (first + offset), beat: position, beats, pass, passes },
      });
    }
  });
  return cues;
}

export function beatsBetween(song: Song, playback: Playback, fromMs: number, toMs: number): Beat[] {
  const bars = barsOfPlayback(song, playback, toMs, fromMs);
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
        passInSection: bar.pass,
        passesInSection: bar.passes,
        passMs: bar.passMs,
        msIntoPass: bar.msIntoPass + (beat - 1) * bar.beatMs,
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

const barsOfPlayback = (song: Song, playback: Playback, untilMs = Infinity, fromMs = -Infinity) => {
  const horizon = untilMs + LOOKAHEAD_BARS * longestOf(song, longestBarMsOf);
  return segmentsOf(song, playback).flatMap((segment) => barsOf(song, segment, fromMs, horizon));
};

function songEndOf(bars: readonly Bar[]): number | null {
  const last = bars.at(-1);
  return last ? last.startsAt + last.beatMs * last.beatsPerBar : null;
}

export function vampingSection(song: Song, playback: Playback): number | null {
  const last = segmentsOf(song, playback).at(-1);
  return last !== undefined && last.vamp && song.sections[last.startSection] !== undefined ? last.startSection : null;
}

export function playbackEndsAt(song: Song, playback: Playback): number {
  if (vampingSection(song, playback) !== null) return playback.stopsAt ?? Infinity;
  return Math.min(songEndOf(barsOfPlayback(song, playback)) ?? playback.startsAt, playback.stopsAt ?? Infinity);
}

export type SectionPass = { sectionIndex: number; pass: number };

export function sectionPassBefore(song: Song, playback: Playback, atMs: number): SectionPass | null {
  const bars = barsOfPlayback(song, playback, atMs, atMs);
  let found: Bar | null = null;
  for (const bar of bars) if (bar.startsAt < atMs) found = bar;
  return found?.sectionIndex == null ? null : { sectionIndex: found.sectionIndex, pass: found.pass };
}

export function commandBoundary(song: Song, playback: Playback, timing: CommandTiming): number | null {
  const earliest = timing.nowMs + timing.minLeadMs;
  const bars = barsOfPlayback(song, playback, earliest + longestOf(song, sectionMsOf), earliest);
  const songEndsAt = vampingSection(song, playback) === null ? songEndOf(barsOfPlayback(song, playback)) : null;
  const candidates = bars
    .filter((bar) => bar.section !== null && (timing.mode === "nextBar" || startsSection(bar)))
    .map((bar) => bar.startsAt);
  if (songEndsAt !== null) candidates.push(songEndsAt);
  const stopsAt = playback.stopsAt ?? Infinity;
  return candidates.find((at) => at > earliest && at < stopsAt) ?? null;
}
