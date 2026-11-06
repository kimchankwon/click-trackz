import { playbackEndsAt, type Playback, type Song } from "./timeline";

export type SongSpan = { startsAt: number; endsAt: number };

export function playbackSpan(song: Song, playback: Playback): SongSpan {
  return { startsAt: playback.startsAt, endsAt: playbackEndsAt(song, playback) };
}

export function songLengthMs(song: Song, startSection = 0, startBar = 1): number {
  if (song.sections.length === 0) return 0;
  return playbackEndsAt(song, { startsAt: 0, startSection, startBar });
}

export function elapsedShare(span: SongSpan, nowMs: number | null): number {
  const total = span.endsAt - span.startsAt;
  if (nowMs === null || total <= 0) return 0;
  return Math.min(1, Math.max(0, (nowMs - span.startsAt) / total));
}

export function clockText(ms: number): string {
  const seconds = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}
