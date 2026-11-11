/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
    const userId = await t.run(async (ctx) => {
      const id = await ctx.db.insert("users", profile);
      if (profile.email !== undefined) await ctx.db.insert("subscriptions", { userId: id, plan: "pro", expiresAt: null, syncedAt: 0 });
      return id;
    });
    return t.withIdentity({ subject: `${userId}|session` });
  };
  const admin = await as({ email: "admin@example.com" });
  const { groupId, joinCode } = await admin.mutation(api.groups.createGroup, { name: "Band", displayName: "Admin" });
  const member = await as({ isAnonymous: true });
  await member.mutation(api.groups.joinGroup, { joinCode, displayName: "Member" });
  const first = await admin.mutation(api.songs.createSong, { groupId, title: "First" });
  await admin.mutation(api.songs.updateSong, { songId: first, countIn: false, sections: [verse, chorus] });
  return { admin, member, groupId, first };
}

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
    await expect(member.mutation(api.playback.repeatSection, { groupId })).rejects.toThrow(/Only Playback Managers and above/);
    await admin.mutation(api.playback.repeatSection, { groupId, startsAt, vamp: true });
    const vamping = (await member.query(api.playback.current, { groupId }))!;
    expect(vamping.jumps).toEqual([{ at: startsAt + 4_000, toSection: 0, cueFrom: startsAt + 1_500, vamp: true }]);
    expect(playbackEndsAt(vamping.song, vamping)).toBe(Infinity);
    await expect(admin.mutation(api.playback.repeatSection, { groupId, startsAt })).rejects.toThrow(/Already vamping/);

    vi.setSystemTime(startsAt + 9_000);
    await admin.mutation(api.playback.endVamp, { groupId, startsAt });
    const ended = (await member.query(api.playback.current, { groupId }))!;
    expect(ended.jumps.at(-1)).toEqual({ at: startsAt + 12_000, toSection: 1, cueFrom: startsAt + 10_000 });
    expect(playbackEndsAt(ended.song, ended)).toBe(startsAt + 14_000);
    await expect(admin.mutation(api.playback.endVamp, { groupId, startsAt })).rejects.toThrow(/Nothing is vamping/);
  });

  it("repeats only the pass that is ending when a Section plays more than once", async () => {
    const { admin, member, groupId } = await setup();
    const songId = await admin.mutation(api.songs.createSong, { groupId, title: "Again" });
    await admin.mutation(api.songs.updateSong, { songId, countIn: false, sections: [{ ...verse, plays: 3 }, chorus] });
    await admin.mutation(api.playback.start, { groupId, songId });
    const started = (await member.query(api.playback.current, { groupId }))!;
    const { startsAt } = started;
    expect(playbackEndsAt(started.song, started)).toBe(startsAt + 14_000);
    vi.setSystemTime(startsAt + 4_500);
    await admin.mutation(api.playback.repeatSection, { groupId, startsAt });
    const repeated = (await member.query(api.playback.current, { groupId }))!;
    expect(repeated.jumps).toEqual([{ at: startsAt + 8_000, toSection: 0, pass: 2, cueFrom: startsAt + 5_500 }]);
    expect(playbackEndsAt(repeated.song, repeated)).toBe(startsAt + 18_000);
  });
});
