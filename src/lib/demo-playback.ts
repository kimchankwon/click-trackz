import { lockScreenActionFor, livePlayback, type LockScreenCommand } from "@/lib/lock-screen";
import { jumpsAfter, startedPlayback, stopTime, type StartedPlayback } from "@/sync/commands";
import { beatsBetween, longestBeatMs, playbackEndsAt, type Beat, type Section, type Song } from "@/sync/timeline";

export type DemoSong = Song & { title: string; bpm: number };

const section = (sectionType: string, bars: number, bpm: number, number?: number, letter?: Section["letter"]): Section => ({
  sectionType,
  bars,
  beatsPerBar: 4,
  beatUnit: 4,
  bpm,
  ...(number === undefined ? {} : { number }),
  ...(letter === undefined ? {} : { letter }),
});

const song = (title: string, bpm: number, sections: (readonly [string, number, number?, Section["letter"]?])[]): DemoSong => ({
  title,
  bpm,
  countIn: false,
  sections: sections.map(([type, bars, number, letter]) => section(type, bars, bpm, number, letter)),
});

export const DEMO_SONGS: readonly DemoSong[] = [
  song("Sunday Opener", 120, [["Intro", 2], ["Verse", 4, 1], ["Chorus", 4, 1], ["Bridge", 2], ["Chorus", 4, 2]]),
  song("Higher Ground", 96, [["Intro", 2], ["Verse", 4, 1], ["Pre-Chorus", 2], ["Chorus", 4, 1]]),
  song("Last Light", 132, [["Intro", 2], ["Chorus", 4, 1, "A"], ["Chorus", 4, 1, "B"], ["Outro", 2]]),
];

export type DemoState = { songIndex: number; playback: StartedPlayback | null };

export const DEMO_START: DemoState = { songIndex: 0, playback: null };

export type DemoStatus = "idle" | "starting" | "playing" | "stopping";

export type DemoFrame = {
  status: DemoStatus;
  song: DemoSong;
  beat: Beat | null;
  sectionIndex: number | null;
  jumpingTo: number | null;
  elapsedMs: number;
  lengthMs: number;
};

const songOf = (state: DemoState) => DEMO_SONGS[state.songIndex];

const lengthOf = (demo: DemoSong) => demo.sections.reduce((sum, s) => sum + s.bars * s.beatsPerBar * (60_000 / s.bpm), 0);

export function demoFrameAt(state: DemoState, nowMs: number): DemoFrame {
  const demo = songOf(state);
  const lengthMs = lengthOf(demo);
  const { playback } = state;
  const live = livePlayback(demo, playback, nowMs);
  if (playback === null || !live.playing) return { status: "idle", song: demo, beat: null, sectionIndex: null, jumpingTo: null, elapsedMs: 0, lengthMs };
  const starting = nowMs < playback.startsAt;
  const beat = starting ? null : live.latest;
  const pending = playback.jumps.find((jump) => jump.at > nowMs);
  return {
    status: playback.stopsAt !== null ? "stopping" : starting ? "starting" : "playing",
    song: demo,
    beat,
    sectionIndex: beat?.sectionIndex ?? (starting ? playback.startSection : null),
    jumpingTo: pending?.toSection ?? null,
    elapsedMs: Math.max(0, nowMs - playback.startsAt),
    lengthMs,
  };
}

const isLive = (state: DemoState, nowMs: number) => demoFrameAt(state, nowMs).status !== "idle";

export function demoStart(state: DemoState, nowMs: number, fromSection?: number): DemoState {
  if (isLive(state, nowMs)) return state;
  return { ...state, playback: startedPlayback(songOf(state), fromSection === undefined ? {} : { fromSection }, nowMs) };
}

export function demoStop(state: DemoState, nowMs: number): DemoState {
  if (state.playback === null) return state;
  const stopsAt = stopTime(songOf(state), state.playback, nowMs);
  return stopsAt === null ? state : { ...state, playback: { ...state.playback, stopsAt } };
}

export function demoJump(state: DemoState, toSection: number, nowMs: number): DemoState {
  if (state.playback === null || demoFrameAt(state, nowMs).status !== "playing") return state;
  const jumps = jumpsAfter(songOf(state), state.playback, toSection, "nextBar", nowMs);
  return jumps === null ? state : { ...state, playback: { ...state.playback, jumps } };
}

export function demoStepSong(state: DemoState, step: -1 | 1, nowMs: number): DemoState {
  const songIndex = state.songIndex + step;
  if (isLive(state, nowMs) || songIndex < 0 || songIndex >= DEMO_SONGS.length) return state;
  return { songIndex, playback: null };
}

export function demoCommand(state: DemoState, command: LockScreenCommand, nowMs: number): DemoState {
  const frame = demoFrameAt(state, nowMs);
  const action = lockScreenActionFor(command, {
    steers: true,
    playing: frame.status !== "idle",
    muted: false,
    stopping: frame.status === "stopping",
    canStart: true,
    sectionIndex: frame.sectionIndex,
    sectionCount: frame.song.sections.length,
    hasPreviousSong: state.songIndex > 0,
    hasNextSong: state.songIndex < DEMO_SONGS.length - 1,
  });
  if (action === null) return state;
  if (action.kind === "start") return demoStart(state, nowMs);
  if (action.kind === "stop") return demoStop(state, nowMs);
  if (action.kind === "jump") return demoJump(state, action.toSection, nowMs);
  if (action.kind === "stepSong") return demoStepSong(state, action.step, nowMs);
  return state;
}

export function nextDemoChangeAt(state: DemoState, nowMs: number): number | null {
  const { playback } = state;
  if (playback === null || !isLive(state, nowMs)) return null;
  const demo = songOf(state);
  const next = beatsBetween(demo, playback, nowMs + 1, nowMs + 1 + 2 * longestBeatMs(demo))[0]?.at;
  const endsAt = playbackEndsAt(demo, playback);
  const pendingJump = playback.jumps.find((jump) => jump.at > nowMs)?.at;
  return Math.min(next ?? endsAt, endsAt, pendingJump ?? Infinity, playback.startsAt > nowMs ? playback.startsAt : Infinity);
}
