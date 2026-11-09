/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MIN_COMMAND_LEAD_MS } from "../src/sync/commands";
import { playbackEndsAt } from "../src/sync/timeline";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const NOW = 1_000_000;
const verse = { sectionType: "Verse", bars: 2, beatsPerBar: 4, bpm: 120 };
const chorus = { sectionType: "Chorus", bars: 1, beatsPerBar: 4, bpm: 120 };

async function setup() {
  const t = convexTest(schema, modules);
  const as = async (profile: { email?: string; isAnonymous?: boolean }) => {
    const userId = await t.run((ctx) => ctx.db.insert("users", profile));
    return t.withIdentity({ subject: `${userId}|session` });
  };
  const admin = await as({ email: "admin@example.com" });
  const { groupId, joinCode } = await admin.mutation(api.groups.createGroup, { name: "Band", displayName: "Admin" });
  const member = await as({ isAnonymous: true });
  await member.mutation(api.groups.joinGroup, { joinCode, displayName: "Member" });
  const song = async (title: string, sections: (typeof verse)[]) => {
    const songId = await admin.mutation(api.songs.createSong, { groupId, title });
    await admin.mutation(api.songs.updateSong, { songId, countIn: false, sections });
    return songId;
  };
  const first = await song("First", [verse, chorus]);
  const unfinished = await admin.mutation(api.songs.createSong, { groupId, title: "Unfinished" });
  const third = await song("Third", [chorus]);
  const setlistId = await admin.mutation(api.setlists.createSetlist, { groupId, name: "Sunday" });
  await admin.mutation(api.setlists.save, {
    setlistId,
    revision: 0,
    name: "Sunday",
    entries: [first, unfinished, third].map((songId) => ({ songId })),
  });
  await admin.mutation(api.setlists.setCurrent, { groupId, setlistId });
  return { t, admin, member, groupId, first, third };
}

const runAll = (t: Awaited<ReturnType<typeof setup>>["t"]) => t.finishAllScheduledFunctions(vi.runAllTimers);

describe("Repeat and Vamp on the server", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => vi.useRealTimers());

  it("repeats the current Section once, or vamps on it until an Admin ends the vamp", async () => {
    const { admin, member, groupId, first } = await setup();
    await admin.mutation(api.playback.start, { groupId, songId: first });
    const { startsAt } = (await member.query(api.playback.current, { groupId }))!;
    vi.setSystemTime(startsAt + 500);
    await expect(member.mutation(api.playback.repeatSection, { groupId })).rejects.toThrow(/Only Admins/);
    await admin.mutation(api.playback.repeatSection, { groupId, startsAt, vamp: true });
    const vamping = (await member.query(api.playback.current, { groupId }))!;
    expect(vamping.jumps).toEqual([{ at: startsAt + 4_000, toSection: 0, cueFrom: startsAt + 1_500, loop: true }]);
    expect(playbackEndsAt(vamping.song, vamping)).toBe(Infinity);
    await expect(admin.mutation(api.playback.repeatSection, { groupId, startsAt })).rejects.toThrow(/Already vamping/);

    vi.setSystemTime(startsAt + 9_000);
    await admin.mutation(api.playback.endVamp, { groupId, startsAt });
    const ended = (await member.query(api.playback.current, { groupId }))!;
    expect(ended.jumps.at(-1)).toEqual({ at: startsAt + 12_000, toSection: 1, cueFrom: startsAt + 10_000 });
    expect(playbackEndsAt(ended.song, ended)).toBe(startsAt + 14_000);
    await expect(admin.mutation(api.playback.endVamp, { groupId, startsAt })).rejects.toThrow(/Nothing is vamping/);
  });
});

describe("Setlist auto-advance", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => vi.useRealTimers());

  it("starts the next playable Song in the Current setlist a moment after one ends, and stops after the last", async () => {
    const { t, admin, member, groupId, first, third } = await setup();
    await admin.mutation(api.playback.start, { groupId, songId: first, advance: true });
    const playing = (await member.query(api.playback.current, { groupId }))!;
    expect(playing.advance).toBe(true);
    const firstEndsAt = playbackEndsAt(playing.song, playing);
    await runAll(t);
    const next = (await member.query(api.playback.current, { groupId }))!;
    expect(next).toMatchObject({ songId: third, startsAt: firstEndsAt + MIN_COMMAND_LEAD_MS, advance: true, stopsAt: null });
    expect(await t.run((ctx) => ctx.db.system.query("_scheduled_functions").filter((q) => q.eq(q.field("state.kind"), "pending")).collect())).toEqual([]);
  });

  it("does not advance after a Stop, or when it was not asked for", async () => {
    const { t, admin, member, groupId, first } = await setup();
    await admin.mutation(api.playback.start, { groupId, songId: first, advance: true });
    const { startsAt } = (await member.query(api.playback.current, { groupId }))!;
    vi.setSystemTime(startsAt + 1_000);
    await admin.mutation(api.playback.stop, { groupId, startsAt });
    await runAll(t);
    expect((await member.query(api.playback.current, { groupId }))!.songId).toBe(first);

    await admin.mutation(api.playback.start, { groupId, songId: first });
    await runAll(t);
    expect((await member.query(api.playback.current, { groupId }))!).toMatchObject({ songId: first, advance: false });
  });

  it("waits while the Group vamps, and goes on once the vamp ends", async () => {
    const { t, admin, member, groupId, first, third } = await setup();
    await admin.mutation(api.playback.start, { groupId, songId: first, advance: true });
    const { startsAt } = (await member.query(api.playback.current, { groupId }))!;
    vi.setSystemTime(startsAt + 500);
    await admin.mutation(api.playback.repeatSection, { groupId, startsAt, vamp: true });
    await runAll(t);
    expect((await member.query(api.playback.current, { groupId }))!.songId).toBe(first);
    vi.setSystemTime(startsAt + 30_000);
    await admin.mutation(api.playback.endVamp, { groupId, startsAt });
    await runAll(t);
    expect((await member.query(api.playback.current, { groupId }))!.songId).toBe(third);
  });

  it("can be switched on or off while a Song plays", async () => {
    const { t, admin, member, groupId, first, third } = await setup();
    await admin.mutation(api.playback.start, { groupId, songId: first });
    const { startsAt } = (await member.query(api.playback.current, { groupId }))!;
    await expect(member.mutation(api.playback.setAdvance, { groupId, startsAt, advance: true })).rejects.toThrow(/Only Admins/);
    await admin.mutation(api.playback.setAdvance, { groupId, startsAt, advance: true });
    await runAll(t);
    expect((await member.query(api.playback.current, { groupId }))!.songId).toBe(third);
    const { startsAt: thirdStartsAt } = (await member.query(api.playback.current, { groupId }))!;
    await admin.mutation(api.playback.setAdvance, { groupId, startsAt: thirdStartsAt, advance: false });
    expect((await member.query(api.playback.current, { groupId }))!.advance).toBe(false);
  });
});
