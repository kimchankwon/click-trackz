export const LOCK_SCREEN_COMMANDS = ["play", "pause", "stop", "nextTrack", "previousTrack"] as const;

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
    speed: playing && !muted ? 1 : 0,
  };
}
