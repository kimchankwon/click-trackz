import type { Beat } from "./timeline";

export type BeatPlace = {
  sectionIndex: number | null;
  passStartAt: number;
  beatsPerBar: number;
  beatUnit: number;
  lead: Beat["lead"];
};

export type ShownBeat = {
  get: () => Beat | null;
  set: (beat: Beat | null) => void;
  subscribe: (listener: () => void) => () => void;
};

const sameCue = (a: Beat["voiceCue"], b: Beat["voiceCue"]) =>
  a === b || (a !== null && b !== null && a.sectionType === b.sectionType && a.number === b.number && a.letter === b.letter);

const sameLead = (a: Beat["lead"], b: Beat["lead"]) =>
  a?.barsLeft === b?.barsLeft && a?.beats === b?.beats && a?.pass === b?.pass && sameCue(a?.cue ?? null, b?.cue ?? null);

export const sameBeat = (a: Beat | null, b: Beat | null) =>
  a === b || (a !== null && b !== null && a.at === b.at && a.sectionIndex === b.sectionIndex && sameLead(a.lead, b.lead));

export const placeOf = (beat: Beat | null): BeatPlace | null =>
  beat === null
    ? null
    : { sectionIndex: beat.sectionIndex, passStartAt: Math.round(beat.at - beat.msIntoPass), beatsPerBar: beat.beatsPerBar, beatUnit: beat.beatUnit, lead: beat.lead };

export const samePlace = (a: BeatPlace | null, b: BeatPlace | null) =>
  a === b ||
  (a !== null &&
    b !== null &&
    a.sectionIndex === b.sectionIndex &&
    a.passStartAt === b.passStartAt &&
    a.beatsPerBar === b.beatsPerBar &&
    a.beatUnit === b.beatUnit &&
    sameLead(a.lead, b.lead));

export function createShownBeat(): ShownBeat {
  let shown: Beat | null = null;
  const listeners = new Set<() => void>();
  return {
    get: () => shown,
    set: (beat) => {
      if (sameBeat(shown, beat)) return;
      shown = beat;
      for (const listener of listeners) listener();
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
