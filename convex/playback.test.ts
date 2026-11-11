/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LEAD_IN_MS, STOP_LEAD_MS } from "../src/sync/commands";
import { demoSong } from "../src/sync/demo-song";
import { playbackEndsAt } from "../src/sync/timeline";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const NOW = 1_000_000;

async function setupGroup() {
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
    expect(playback).toMatchObject({ songId, startsAt: NOW + LEAD_IN_MS, startSection: 0, jumps: [], stopsAt: null });
  });

  it("gives a restart in the same instant its own first beat", async () => {
    const { admin, member, groupId, songId } = await setupGroup();
    vi.setSystemTime(NOW);
    await admin.mutation(api.playback.start, { groupId, songId });
    const first = (await member.query(api.playback.current, { groupId }))!;
    expect(first.startsAt).toBe(NOW + LEAD_IN_MS);
    await admin.mutation(api.playback.start, { groupId, songId });
    const second = (await member.query(api.playback.current, { groupId }))!;
    expect(second.startsAt).toBe(NOW + LEAD_IN_MS + 1);
    await expect(admin.mutation(api.playback.stop, { groupId, startsAt: first.startsAt })).rejects.toThrow(/already ended/);
  });

  it("starts one second after the press on the shared clock, however slow a Member's connection", async () => {
    const { admin, member, groupId, songId } = await setupGroup();
    vi.setSystemTime(NOW - 1_000);
    await member.mutation(api.presence.heartbeat, { groupId, screenId: "phone", onPlay: true, roundTripMs: 1_900 });
    vi.setSystemTime(NOW);
    await admin.mutation(api.playback.start, { groupId, songId });
    expect((await member.query(api.playback.current, { groupId }))?.startsAt).toBe(NOW + 1_000);
  });

  it("gives every Member the Song's Clicks per beat with the Start", async () => {
    const { admin, member, groupId, songId } = await setupGroup();
    await admin.mutation(api.songs.updateSong, { songId, subdivision: 3 });
    vi.setSystemTime(NOW);
    await admin.mutation(api.playback.start, { groupId, songId });
    expect((await member.query(api.playback.current, { groupId }))?.song).toMatchObject({ subdivision: 3 });
  });

  it("names the Admin who started Playback, and stops naming them once they leave the Group", async () => {
    const { t, admin, member, groupId, songId } = await setupGroup();
    vi.setSystemTime(NOW);
    await admin.mutation(api.playback.start, { groupId, songId });
    expect(await member.query(api.playback.current, { groupId })).toMatchObject({ startedByName: "Admin" });
    await admin.mutation(api.groups.setDisplayName, { groupId, displayName: "Sam" });
    expect(await member.query(api.playback.current, { groupId })).toMatchObject({ startedByName: "Sam" });
    await t.run(async (ctx) => {
      const playback = await ctx.db.query("playbacks").first();
      const starter = await ctx.db
        .query("memberships")
        .withIndex("by_group_user", (q) => q.eq("groupId", groupId).eq("userId", playback!.startedBy))
        .unique();
      await ctx.db.delete(starter!._id);
    });
    expect(await member.query(api.playback.current, { groupId })).toMatchObject({ startedByName: null });
  });

  it("lands a next-bar Jump on the first bar line at least one second away", async () => {
    const { admin, groupId, songId } = await setupGroup();
    vi.setSystemTime(NOW);
    await admin.mutation(api.playback.start, { groupId, songId });
    const startsAt = NOW + LEAD_IN_MS;
    vi.setSystemTime(startsAt + 3_000);
    await admin.mutation(api.playback.jump, { groupId, toSection: 3, mode: "nextBar" });
    const playback = await admin.query(api.playback.current, { groupId });
    expect(playback?.jumps).toEqual([{ at: startsAt + 5_000, toSection: 3, cueFrom: startsAt + 4_000 }]);
  });

  it("starts from a tapped Section with a one-bar Count-in", async () => {
    const { admin, member, groupId, songId } = await setupGroup();
    vi.setSystemTime(NOW);
    await admin.mutation(api.playback.start, { groupId, songId, fromSection: 3 });
    const playback = await member.query(api.playback.current, { groupId });
    expect(playback).toMatchObject({ startsAt: NOW + LEAD_IN_MS, startSection: 3, song: { countIn: true } });
  });

  it("starts from a chosen bar of a Section", async () => {
    const { admin, member, groupId, songId } = await setupGroup();
    vi.setSystemTime(NOW);
    await admin.mutation(api.playback.start, { groupId, songId, fromSection: 3, fromBar: 2 });
    expect(await member.query(api.playback.current, { groupId })).toMatchObject({ startSection: 3, startBar: 2, song: { countIn: true } });
    await expect(admin.mutation(api.playback.start, { groupId, songId, fromSection: 3, fromBar: 9 })).rejects.toThrow(/only has 4 bars/);
  });

  it("refuses to start from a Section that is not in the Song", async () => {
    const { admin, groupId, songId } = await setupGroup();
    await expect(admin.mutation(api.playback.start, { groupId, songId, fromSection: 99 })).rejects.toThrow(/not in the Song/);
  });

  it("stops a moment after Stop is pressed, names who stopped it, and forgets them at the next Start", async () => {
    const { admin, member, groupId, songId } = await setupGroup();
    vi.setSystemTime(NOW);
    await admin.mutation(api.playback.start, { groupId, songId });
    expect(await member.query(api.playback.current, { groupId })).toMatchObject({ stoppedBy: null, stoppedByName: null });
    const startsAt = NOW + LEAD_IN_MS;
    vi.setSystemTime(startsAt + 6_200);
    await admin.mutation(api.playback.stop, { groupId });
    expect(await member.query(api.playback.current, { groupId })).toMatchObject({ stopsAt: startsAt + 6_200 + STOP_LEAD_MS, stoppedByName: "Admin" });
    vi.setSystemTime(startsAt + 10_000);
    await admin.mutation(api.playback.start, { groupId, songId });
    expect(await member.query(api.playback.current, { groupId })).toMatchObject({ stopsAt: null, stoppedBy: null, stoppedByName: null });
  });

  it("still records a Stop pressed in the Song's last second, landing on its natural end", async () => {
    const { admin, member, groupId, songId } = await setupGroup();
    vi.setSystemTime(NOW);
    await admin.mutation(api.playback.start, { groupId, songId });
    const started = (await member.query(api.playback.current, { groupId }))!;
    const endsAt = playbackEndsAt(started.song, started);
    vi.setSystemTime(endsAt - 600);
    await admin.mutation(api.playback.stop, { groupId, startsAt: started.startsAt });
    expect(await member.query(api.playback.current, { groupId })).toMatchObject({ stopsAt: endsAt, stoppedByName: "Admin" });
  });

  it("refuses a Stop or Jump meant for a Playback that another Start has already replaced", async () => {
    const { admin, member, groupId, songId } = await setupGroup();
    vi.setSystemTime(NOW);
    await admin.mutation(api.playback.start, { groupId, songId });
    const first = await member.query(api.playback.current, { groupId });
    vi.setSystemTime(NOW + 500);
    await admin.mutation(api.playback.start, { groupId, songId });
    await expect(admin.mutation(api.playback.stop, { groupId, startsAt: first!.startsAt })).rejects.toThrow(/already ended/);
    await expect(admin.mutation(api.playback.jump, { groupId, toSection: 1, mode: "nextBar", startsAt: first!.startsAt })).rejects.toThrow(/already ended/);
    const second = await member.query(api.playback.current, { groupId });
    expect(second).toMatchObject({ startsAt: NOW + 500 + LEAD_IN_MS, stopsAt: null, jumps: [] });
    await admin.mutation(api.playback.stop, { groupId, startsAt: second!.startsAt });
    expect((await member.query(api.playback.current, { groupId }))!.stopsAt).toBe(NOW + 500 + STOP_LEAD_MS);
  });

  it("never runs My Library on the server clock", async () => {
    const { admin } = await setupGroup();
    const offlineId = await admin.mutation(api.groups.openOffline, {});
    const songId = await admin.mutation(api.songs.createSong, { groupId: offlineId, title: "Etude" });
    await admin.mutation(api.songs.updateSong, { songId, sections: [...demoSong.sections] });
    await expect(admin.mutation(api.playback.start, { groupId: offlineId, songId })).rejects.toThrow(/My Library plays on this device only/);
  });

  it("refuses Playback commands from plain Members and reads from people outside the Group", async () => {
    const { t, member, outsider, groupId, songId } = await setupGroup();
    await expect(member.mutation(api.playback.start, { groupId, songId })).rejects.toThrow(/Only Playback Managers and above/);
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
    const startsAt = NOW + LEAD_IN_MS;
    vi.setSystemTime(startsAt + 3_000);
    await admin.mutation(api.playback.jump, { groupId, toSection: 3, mode: "nextBar" });
    expect((await member.query(api.playback.current, { groupId }))?.jumps).toEqual([{ at: startsAt + 5_000, toSection: 3, cueFrom: startsAt + 4_000 }]);
  });
});
