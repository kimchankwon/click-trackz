/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { demoSong } from "../src/sync/demo-song";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const NOW = 1_000_000;

async function setupGroup() {
  const t = convexTest(schema, modules);
  const as = async (profile: { email?: string; isAnonymous?: boolean }) => {
    const userId = await t.run((ctx) => ctx.db.insert("users", profile));
    return t.withIdentity({ subject: `${userId}|session` });
  };
  const admin = await as({ email: "admin@example.com" });
  const { groupId, joinCode } = await admin.mutation(api.groups.createGroup, { name: "Band", displayName: "Admin" });
  const member = await as({ isAnonymous: true });
  await member.mutation(api.groups.joinGroup, { joinCode, displayName: "Member" });
  const outsider = await as({ isAnonymous: true });
  const songId = await admin.mutation(api.songs.createSong, { groupId, title: "Demo" });
  await admin.mutation(api.songs.updateSong, { songId, sections: [...demoSong.sections] });
  return { t, admin, member, outsider, groupId, songId };
}

describe("Group Playback", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW - 60_000);
  });
  afterEach(() => vi.useRealTimers());

  it("starts one Lead-in after the server receives an Admin's Start, for every Member to read", async () => {
    const { admin, member, groupId, songId } = await setupGroup();
    vi.setSystemTime(NOW);
    await admin.mutation(api.playback.start, { groupId, songId });
    const playback = await member.query(api.playback.current, { groupId });
    expect(playback).toMatchObject({ songId, startsAt: NOW + 2_000, startSection: 0, jumps: [], stopsAt: null });
  });

  it("lands a next-bar Jump on the first bar line at least one second away", async () => {
    const { admin, groupId, songId } = await setupGroup();
    vi.setSystemTime(NOW);
    await admin.mutation(api.playback.start, { groupId, songId });
    const startsAt = NOW + 2_000;
    vi.setSystemTime(startsAt + 3_000);
    await admin.mutation(api.playback.jump, { groupId, toSection: 3, mode: "nextBar" });
    const playback = await admin.query(api.playback.current, { groupId });
    expect(playback?.jumps).toEqual([{ at: startsAt + 5_000, toSection: 3 }]);
  });

  it("lands Stop on the first bar line at least one second away", async () => {
    const { admin, groupId, songId } = await setupGroup();
    vi.setSystemTime(NOW);
    await admin.mutation(api.playback.start, { groupId, songId });
    const startsAt = NOW + 2_000;
    vi.setSystemTime(startsAt + 6_200);
    await admin.mutation(api.playback.stop, { groupId });
    const playback = await admin.query(api.playback.current, { groupId });
    expect(playback?.stopsAt).toBe(startsAt + 7_500);
  });

  it("refuses Playback commands from Members and reads from people outside the Group", async () => {
    const { t, member, outsider, groupId, songId } = await setupGroup();
    await expect(member.mutation(api.playback.start, { groupId, songId })).rejects.toThrow(/Only Admins/);
    await expect(outsider.query(api.playback.current, { groupId })).rejects.toThrow(/not in this Group/);
    await expect(t.query(api.playback.current, { groupId })).rejects.toThrow(/Sign in/);
  });

  it("will not start a Song that still needs structure", async () => {
    const { admin, groupId } = await setupGroup();
    const empty = await admin.mutation(api.songs.createSong, { groupId, title: "Kingdom Come" });
    await expect(admin.mutation(api.playback.start, { groupId, songId: empty })).rejects.toThrow(/needs structure/);
  });

  it("keeps playing the Song as it was at Start when an Admin edits it mid-Playback", async () => {
    const { admin, member, groupId, songId } = await setupGroup();
    vi.setSystemTime(NOW);
    await admin.mutation(api.playback.start, { groupId, songId });
    await admin.mutation(api.songs.updateSong, {
      songId,
      sections: [{ sectionType: "Verse", bars: 1, beatsPerBar: 4, bpm: 60 }],
    });
    const playback = await member.query(api.playback.current, { groupId });
    expect(playback?.song.sections).toEqual([...demoSong.sections]);
    const startsAt = NOW + 2_000;
    vi.setSystemTime(startsAt + 3_000);
    await admin.mutation(api.playback.jump, { groupId, toSection: 3, mode: "nextBar" });
    expect((await member.query(api.playback.current, { groupId }))?.jumps).toEqual([{ at: startsAt + 5_000, toSection: 3 }]);
  });
});
