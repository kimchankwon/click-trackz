import { commandBoundary, cueLeadBarsOf, playbackEndsAt, sectionPassBefore, subdivisionOf, vampingSection, type Jump, type Playback, type Song } from "./timeline";

export const LEAD_IN_MS = 1_000;
export const OFFLINE_LEAD_IN_MS = 500;
export const MIN_COMMAND_LEAD_MS = 1_000;
export const STOP_LEAD_MS = 1_000;

export type StartFrom = { fromSection?: number; fromBar?: number };

export type StartedPlayback<S extends Song = Song> = {
  song: { countIn: boolean; subdivision?: number; cueLeadBars?: number; sections: S["sections"] };
  startsAt: number;
  startSection: number;
  startBar: number;
  jumps: Jump[];
  stopsAt: number | null;
};

export function startProblem(song: Song & { title: string }, { fromSection, fromBar }: StartFrom): string | null {
  if (song.sections.length === 0) return `${song.title} needs structure: add at least one Section first`;
  if (fromSection !== undefined && (!Number.isInteger(fromSection) || fromSection < 0 || fromSection >= song.sections.length)) {
    return "That Section is not in the Song";
  }
  const startSectionBars = song.sections[fromSection ?? 0].bars;
  if (fromBar !== undefined && (!Number.isInteger(fromBar) || fromBar < 1 || fromBar > startSectionBars)) {
    return `That Section only has ${startSectionBars} bars`;
  }
  return null;
}

export function startedPlayback<S extends Song>(song: S, { fromSection, fromBar }: StartFrom, nowMs: number, startsAt = nowMs + LEAD_IN_MS): StartedPlayback<S> {
  return {
    song: {
      countIn: fromSection === undefined && fromBar === undefined ? song.countIn : true,
      ...(subdivisionOf(song) > 1 ? { subdivision: subdivisionOf(song) } : {}),
      ...(cueLeadBarsOf(song) === 1 ? { cueLeadBars: 1 } : {}),
      sections: song.sections,
    },
    startsAt,
    startSection: fromSection ?? 0,
    startBar: fromBar ?? 1,
    jumps: [],
    stopsAt: null,
  };
}

export type JumpMode = "nextBar" | "endOfSection";

export function jumpProblem(song: Song, toSection: number): string | null {
  return Number.isInteger(toSection) && toSection >= 0 && toSection < song.sections.length ? null : "That Section is not in the Song";
}

export function jumpsAfter(song: Song, playback: Playback & { jumps: readonly Jump[] }, toSection: number, mode: JumpMode, nowMs: number): Jump[] | null {
  const at = commandBoundary(song, playback, { nowMs, minLeadMs: MIN_COMMAND_LEAD_MS, mode });
  if (at === null) return null;
  return [...playback.jumps.filter((j) => j.at < at), { at, toSection, cueFrom: nowMs + MIN_COMMAND_LEAD_MS }];
}

export function stopTime(song: Song, playback: Playback, nowMs: number, leadMs = STOP_LEAD_MS): number | null {
  const stopsAt = nowMs + leadMs;
  return stopsAt < playbackEndsAt(song, playback) ? stopsAt : null;
}

export type CommandResult = { jumps: Jump[] } | { problem: string };

export function repeatJumps(song: Song, playback: Playback & { jumps: readonly Jump[] }, nowMs: number, vamp: boolean): CommandResult {
  if (vampingSection(song, playback) !== null) return { problem: "Already vamping: end the vamp first" };
  const at = commandBoundary(song, playback, { nowMs, minLeadMs: MIN_COMMAND_LEAD_MS, mode: "endOfSection" });
  if (at === null) return { problem: "Playback has already ended" };
  const ending = sectionPassBefore(song, playback, at);
  if (ending === null) return { problem: "Wait for the first Section before repeating it" };
  const replayedPass = vamp || ending.pass === 1 ? {} : { pass: ending.pass };
  const jump: Jump = { at, toSection: ending.sectionIndex, ...replayedPass, cueFrom: nowMs + MIN_COMMAND_LEAD_MS, ...(vamp ? { vamp: true } : {}) };
  return { jumps: [...playback.jumps.filter((j) => j.at < at), jump] };
}

export function endVampJumps(song: Song, playback: Playback & { jumps: readonly Jump[] }, nowMs: number): CommandResult {
  const section = vampingSection(song, playback);
  if (section === null) return { problem: "Nothing is vamping" };
  const at = commandBoundary(song, playback, { nowMs, minLeadMs: MIN_COMMAND_LEAD_MS, mode: "endOfSection" });
  if (at === null) return { problem: "Playback has already ended" };
  return { jumps: [...playback.jumps.filter((j) => j.at < at), { at, toSection: section + 1, cueFrom: nowMs + MIN_COMMAND_LEAD_MS }] };
}
