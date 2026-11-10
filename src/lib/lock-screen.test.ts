import { describe, expect, it } from "vitest";

import type { Playback, Song } from "@/sync/timeline";

import { infoKeyOf, livePlayback, lockScreenActionFor, lockScreenControls, lockScreenInfo, needsReshow, type LockScreenState } from "./lock-screen";

const BAR_MS = 2_000;
const section = (bars: number) => ({ sectionType: "Verse", bars, beatsPerBar: 4, bpm: 120, voiceCueEnabled: false });

const idleAdmin: LockScreenState = {
  steers: true,
  playing: false,
  muted: false,
  stopping: false,
  canStart: true,
  sectionIndex: null,
  sectionCount: 3,
  hasPreviousSong: true,
  hasNextSong: true,
};

const playingAdmin: LockScreenState = { ...idleAdmin, playing: true, sectionIndex: 1 };
const playingMember: LockScreenState = { ...playingAdmin, steers: false };

describe("lockScreenActionFor", () => {
  it("starts the picked Song when an Admin presses play while idle", () => {
    expect(lockScreenActionFor("play", idleAdmin)).toEqual({ kind: "start" });
    expect(lockScreenActionFor("play", { ...idleAdmin, canStart: false })).toBeNull();
  });

  it("never lets a Member start Playback", () => {
    expect(lockScreenActionFor("play", { ...idleAdmin, steers: false })).toBeNull();
  });

  it("stops for an Admin and mutes for a Member on pause or stop", () => {
    expect(lockScreenActionFor("pause", playingAdmin)).toEqual({ kind: "stop" });
    expect(lockScreenActionFor("stop", playingAdmin)).toEqual({ kind: "stop" });
    expect(lockScreenActionFor("pause", playingMember)).toEqual({ kind: "mute" });
    expect(lockScreenActionFor("pause", { ...playingAdmin, stopping: true })).toBeNull();
    expect(lockScreenActionFor("pause", idleAdmin)).toBeNull();
  });

  it("unmutes on play while muted", () => {
    expect(lockScreenActionFor("play", { ...playingMember, muted: true })).toEqual({ kind: "unmute" });
    expect(lockScreenActionFor("play", playingMember)).toBeNull();
  });

  it("treats the headset press as pause while sound plays, and as play otherwise", () => {
    expect(lockScreenActionFor("togglePlayPause", idleAdmin)).toEqual({ kind: "start" });
    expect(lockScreenActionFor("togglePlayPause", playingAdmin)).toEqual({ kind: "stop" });
    expect(lockScreenActionFor("togglePlayPause", playingMember)).toEqual({ kind: "mute" });
    expect(lockScreenActionFor("togglePlayPause", { ...playingMember, muted: true })).toEqual({ kind: "unmute" });
    expect(lockScreenActionFor("togglePlayPause", { ...playingAdmin, muted: true })).toEqual({ kind: "unmute" });
    expect(lockScreenActionFor("togglePlayPause", { ...idleAdmin, steers: false })).toBeNull();
  });

  it("jumps one Section either way while playing, inside the Song", () => {
    expect(lockScreenActionFor("nextTrack", playingAdmin)).toEqual({ kind: "jump", toSection: 2 });
    expect(lockScreenActionFor("previousTrack", playingAdmin)).toEqual({ kind: "jump", toSection: 0 });
    expect(lockScreenActionFor("nextTrack", { ...playingAdmin, sectionIndex: 2 })).toBeNull();
    expect(lockScreenActionFor("previousTrack", { ...playingAdmin, sectionIndex: 0 })).toBeNull();
    expect(lockScreenActionFor("nextTrack", { ...playingAdmin, sectionIndex: null })).toBeNull();
    expect(lockScreenActionFor("nextTrack", playingMember)).toBeNull();
  });

  it("steps between Songs while idle", () => {
    expect(lockScreenActionFor("nextTrack", idleAdmin)).toEqual({ kind: "stepSong", step: 1 });
    expect(lockScreenActionFor("previousTrack", idleAdmin)).toEqual({ kind: "stepSong", step: -1 });
    expect(lockScreenActionFor("nextTrack", { ...idleAdmin, hasNextSong: false })).toBeNull();
  });
});

describe("lockScreenControls", () => {
  it("keeps the same buttons through a Song, since each change re-sends stale Now Playing time", () => {
    expect(lockScreenControls(playingMember)).toEqual({ play: true, pause: true, stop: true, nextTrack: false, previousTrack: false, togglePlayPause: true });
    expect(lockScreenControls(idleAdmin)).toEqual(lockScreenControls(playingAdmin));
    expect(lockScreenControls(playingAdmin)).toEqual({ play: true, pause: true, stop: true, nextTrack: true, previousTrack: true, togglePlayPause: true });
  });
});

describe("lockScreenInfo", () => {
  const base = { songTitle: "You Alone", section: "Chorus 2", place: "First Setlist", muted: false, lengthMs: 90_000, nowMs: 31_000 };

  it("shows the Section and elapsed time while playing", () => {
    expect(lockScreenInfo({ ...base, playing: true, span: { startsAt: 1_000, endsAt: 61_000 } })).toEqual({
      title: "You Alone",
      artist: "Chorus 2",
      album: "First Setlist",
      duration: 60,
      elapsedTime: 30,
      speed: 1,
    });
  });

  it("shows the Song length at rest while idle", () => {
    expect(lockScreenInfo({ ...base, playing: false, span: null })).toMatchObject({ artist: "First Setlist", duration: 90, elapsedTime: 0, speed: 0 });
  });

  it("holds still while muted or vamping", () => {
    expect(lockScreenInfo({ ...base, playing: true, muted: true, span: { startsAt: 1_000, endsAt: 61_000 } })).toMatchObject({ artist: "Chorus 2, muted", speed: 0 });
    expect(lockScreenInfo({ ...base, playing: true, span: { startsAt: 1_000, endsAt: Infinity } })).toMatchObject({ artist: "Chorus 2", duration: 0, elapsedTime: 0, speed: 0 });
  });
});

describe("Now Playing timing", () => {
  const base = { songTitle: "You Alone", section: "Count-in", place: "First Setlist", muted: false, lengthMs: 60_000, playing: true, span: { startsAt: 10_000, endsAt: 70_000 } };

  it("holds the clock still through the Lead-in, so it starts with the first beat", () => {
    expect(lockScreenInfo({ ...base, nowMs: 9_000 })).toMatchObject({ elapsedTime: 0, speed: 0 });
    expect(lockScreenInfo({ ...base, nowMs: 10_000 })).toMatchObject({ elapsedTime: 0, speed: 1 });
  });

  it("re-sends the time only when what iOS extrapolates has drifted from the real position", () => {
    const shown = lockScreenInfo({ ...base, nowMs: 12_000 });
    const previous = { key: infoKeyOf(shown), elapsedTime: shown.elapsedTime, speed: shown.speed, atMs: 0 };
    expect(needsReshow(null, shown, 0)).toBe(true);
    expect(needsReshow(previous, lockScreenInfo({ ...base, nowMs: 13_000 }), 1_000)).toBe(false);
    expect(needsReshow(previous, lockScreenInfo({ ...base, nowMs: 17_000 }), 1_000)).toBe(true);
    expect(needsReshow(previous, lockScreenInfo({ ...base, section: "Verse", nowMs: 13_000 }), 1_000)).toBe(true);
    expect(needsReshow(previous, lockScreenInfo({ ...base, playing: false, nowMs: 13_000 }), 1_000)).toBe(true);
  });
});

describe("livePlayback", () => {
  const song: Song = { countIn: false, sections: [section(4), section(4)] };
  const playback: Playback = { startsAt: 10_000, startSection: 0, startBar: 1 };

  it("reads the playing Section from the clock, not from the last frame drawn", () => {
    expect(livePlayback(song, playback, 10_000 + 5 * BAR_MS)).toMatchObject({ playing: true, latest: { sectionIndex: 1 } });
    expect(livePlayback(song, playback, 10_000 + BAR_MS)).toMatchObject({ playing: true, latest: { sectionIndex: 0 } });
  });

  it("is idle before a Playback, after its end and without a clock", () => {
    expect(livePlayback(song, playback, 10_000 + 9 * BAR_MS)).toEqual({ playing: false, latest: null });
    expect(livePlayback(song, null, 20_000)).toEqual({ playing: false, latest: null });
    expect(livePlayback(song, playback, null)).toEqual({ playing: false, latest: null });
  });

  it("stops being live at a Stop", () => {
    expect(livePlayback(song, { ...playback, stopsAt: 10_000 + BAR_MS }, 10_000 + 2 * BAR_MS).playing).toBe(false);
  });
});
