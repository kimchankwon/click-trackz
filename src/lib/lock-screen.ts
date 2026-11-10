import { beatsBetween, longestBeatMs, playbackEndsAt, type Beat, type Playback, type Song } from "@/sync/timeline";

const RECENT_BEATS_MS = 10_000;

export type LivePlayback = { playing: boolean; latest: Beat | null };

export function livePlayback(song: Song, playback: Playback | null, nowMs: number | null): LivePlayback {
  if (playback === null || nowMs === null || song.sections.length === 0) return { playing: false, latest: null };
  if (nowMs >= playbackEndsAt(song, playback)) return { playing: false, latest: null };
  const recent = beatsBetween(song, playback, nowMs - Math.max(RECENT_BEATS_MS, longestBeatMs(song)), nowMs + 1);
  return { playing: true, latest: recent.at(-1) ?? null };
}

export const LOCK_SCREEN_CONTROLS = ["play", "pause", "stop", "nextTrack", "previousTrack"] as const;

export type LockScreenControl = (typeof LOCK_SCREEN_CONTROLS)[number];

export const LOCK_SCREEN_COMMANDS = [...LOCK_SCREEN_CONTROLS, "togglePlayPause"] as const;

export type LockScreenCommand = (typeof LOCK_SCREEN_COMMANDS)[number];

export type LockScreenAction =
  | { kind: "start" }
  | { kind: "stop" }
  | { kind: "mute" }
  | { kind: "unmute" }
  | { kind: "jump"; toSection: number }
  | { kind: "stepSong"; step: -1 | 1 };

export type LockScreenState = {
  steers: boolean;
  playing: boolean;
  muted: boolean;
  stopping: boolean;
  canStart: boolean;
  sectionIndex: number | null;
  sectionCount: number;
  hasPreviousSong: boolean;
  hasNextSong: boolean;
};

export function lockScreenActionFor(command: LockScreenCommand, state: LockScreenState): LockScreenAction | null {
  if (command === "togglePlayPause") return lockScreenActionFor(state.playing && !state.muted ? "pause" : "play", state);
  if (command === "play") {
    if (state.playing) return state.muted ? { kind: "unmute" } : null;
    return state.steers && state.canStart ? { kind: "start" } : null;
  }
  if (command === "pause" || command === "stop") {
    if (!state.playing) return null;
    if (state.steers) return state.stopping ? null : { kind: "stop" };
    return state.muted ? null : { kind: "mute" };
  }
  if (!state.steers) return null;
  const step = command === "nextTrack" ? 1 : -1;
  if (state.playing) {
    if (state.stopping || state.sectionIndex === null) return null;
    const toSection = state.sectionIndex + step;
    return toSection >= 0 && toSection < state.sectionCount ? { kind: "jump", toSection } : null;
  }
  const hasSong = step === 1 ? state.hasNextSong : state.hasPreviousSong;
  return hasSong ? { kind: "stepSong", step } : null;
}

export function lockScreenControls(state: LockScreenState): Record<LockScreenCommand, boolean> {
  const controls = {} as Record<LockScreenCommand, boolean>;
  for (const command of LOCK_SCREEN_COMMANDS) controls[command] = lockScreenActionFor(command, state) !== null;
  return controls;
}

export type LockScreenInfo = {
  title: string;
  artist: string;
  album: string;
  duration: number;
  elapsedTime: number;
  speed: number;
};

export function lockScreenInfo({
  songTitle,
  section,
  place,
  playing,
  muted,
  span,
  lengthMs,
  nowMs,
}: {
  songTitle: string;
  section: string;
  place: string;
  playing: boolean;
  muted: boolean;
  span: { startsAt: number; endsAt: number } | null;
  lengthMs: number;
  nowMs: number | null;
}): LockScreenInfo {
  const playingSpan = playing && span !== null && Number.isFinite(span.endsAt) ? span : null;
  const durationMs = playing ? (playingSpan ? playingSpan.endsAt - playingSpan.startsAt : 0) : lengthMs;
  const elapsedMs = playingSpan && nowMs !== null ? Math.min(durationMs, Math.max(0, nowMs - playingSpan.startsAt)) : 0;
  return {
    title: songTitle,
    artist: playing ? (muted ? `${section}, muted` : section) : place,
    album: place,
    duration: Math.max(0, durationMs) / 1000,
    elapsedTime: elapsedMs / 1000,
    speed: playing && !muted && playingSpan !== null ? 1 : 0,
  };
}
