/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { demoSong } from "../src/sync/demo-song";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
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
    return { userId, client: t.withIdentity({ subject: `${userId}|session` }) };
  };
  const admin = await as({ email: "admin@example.com" });
  const { groupId, joinCode } = await admin.client.mutation(api.groups.createGroup, { name: "Band", displayName: "Avery" });
  const member = await as({ email: "member@example.com" });
  await member.client.mutation(api.groups.joinGroup, { joinCode, displayName: "Blake" });
  const songId = await admin.client.mutation(api.songs.createSong, { groupId, title: "Demo" });
  await admin.client.mutation(api.songs.updateSong, { songId, sections: [...demoSong.sections] });
  const latest = (client = admin.client, kind?: "playback" | "song" | "setlist" | "group") =>
    client.query(api.activity.list, { groupId, kind, paginationOpts: { numItems: 50, cursor: null } }).then((result) => result.page);
  const summaries = async (kind?: "playback" | "song" | "setlist" | "group") => (await latest(admin.client, kind)).map((row) => row.summary);
  return { t, as, admin, member, groupId, joinCode, songId, latest, summaries };
}

describe("Activity", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => vi.useRealTimers());

  it("is for Playback Managers and above", async () => {
    const { admin, member, groupId, latest } = await setupGroup();
    await expect(latest(member.client)).rejects.toThrow(/Only Playback Managers and above/);
    await admin.client.mutation(api.groups.setRole, { groupId, userId: member.userId, role: "playbackManager" });
    expect((await latest(member.client)).length).toBeGreaterThan(0);
  });

  it("lists the newest first, with who did it and when", async () => {
    const { latest } = await setupGroup();
    const rows = await latest();
    expect(rows.map((row) => [row.actorName, row.summary])).toEqual([
      ["Avery", "Edited Demo"],
      ["Avery", "Added the Song Demo"],
      ["Blake", "Joined as a Member"],
      ["Avery", "Created the Group"],
    ]);
    expect(rows[0]).toMatchObject({ kind: "song", at: expect.any(Number) });
    expect(rows[0].details).toContain("Added Section 1: Intro");
  });

  it("pages through older entries", async () => {
    const { admin, groupId } = await setupGroup();
    const first = await admin.client.query(api.activity.list, { groupId, paginationOpts: { numItems: 3, cursor: null } });
    expect(first.page).toHaveLength(3);
    expect(first.isDone).toBe(false);
    const rest = await admin.client.query(api.activity.list, { groupId, paginationOpts: { numItems: 3, cursor: first.continueCursor } });
    expect(rest.page.map((row) => row.summary)).toEqual(["Created the Group"]);
    expect(rest.isDone).toBe(true);
  });

  it("records each Playback command, and filters to just them", async () => {
    const { admin, groupId, songId, summaries } = await setupGroup();
    await admin.client.mutation(api.playback.start, { groupId, songId, fromSection: 1, fromBar: 3 });
    vi.setSystemTime(NOW + 3_000);
    await admin.client.mutation(api.playback.jump, { groupId, toSection: 3, mode: "nextBar" });
    await admin.client.mutation(api.playback.stop, { groupId });
    vi.setSystemTime(NOW + 10_000);
    await admin.client.mutation(api.playback.start, { groupId, songId });
    vi.setSystemTime(NOW + 17_000);
    await admin.client.mutation(api.playback.repeatSection, { groupId });
    vi.setSystemTime(NOW + 30_000);
    await admin.client.mutation(api.playback.start, { groupId, songId });
    vi.setSystemTime(NOW + 37_000);
    await admin.client.mutation(api.playback.repeatSection, { groupId, vamp: true });
    await admin.client.mutation(api.playback.endVamp, { groupId });
    expect(await summaries("playback")).toEqual([
      "Ended the vamp on Intro in Demo",
      "Vamped on Intro in Demo",
      "Started Demo",
      "Repeated Intro in Demo",
      "Started Demo",
      "Stopped Demo",
      "Jumped to Chorus in Demo",
      "Started Demo from Verse 1, bar 3",
    ]);
  });

  it("records what changed in a Song, and skips a save that changed nothing", async () => {
    const { admin, songId, latest } = await setupGroup();
    await admin.client.mutation(api.songs.updateSong, { songId, title: "Demo" });
    await admin.client.mutation(api.songs.updateSong, { songId, title: "Demo Two", key: "A" });
    const songRows = await latest(admin.client, "song");
    expect(songRows[0]).toMatchObject({ summary: "Edited Demo Two", details: ["Title: Demo → Demo Two", "Key: none → A"] });
    expect(songRows).toHaveLength(3);
  });

  it("records Songs duplicated, copied and deleted", async () => {
    const { admin, groupId, songId, summaries } = await setupGroup();
    const { groupId: otherId } = await admin.client.mutation(api.groups.createGroup, { name: "Choir", displayName: "Avery" });
    const { songId: copyId } = await admin.client.mutation(api.songs.duplicateSong, { songId });
    await admin.client.mutation(api.songs.copyToGroup, { songId, toGroupId: otherId });
    await admin.client.mutation(api.songs.deleteSong, { songId: copyId });
    expect((await summaries("song")).slice(0, 3)).toEqual(["Deleted the Song Demo 2", "Copied Demo to Choir", "Duplicated Demo as Demo 2"]);
    const other = await admin.client.query(api.activity.list, { groupId: otherId, kind: "song", paginationOpts: { numItems: 5, cursor: null } });
    expect(other.page.map((row) => row.summary)).toEqual(["Copied Demo from Band"]);
    expect(groupId).not.toBe(otherId);
  });

  it("records Setlists added, edited, made current and deleted", async () => {
    const { admin, groupId, songId, latest, summaries } = await setupGroup();
    const setlistId = await admin.client.mutation(api.setlists.createSetlist, { groupId, name: "Sunday" });
    await admin.client.mutation(api.setlists.save, { setlistId, revision: 0, name: "Sunday", entries: [{ songId, key: "G" }] });
    await admin.client.mutation(api.setlists.save, { setlistId, revision: 1, name: "Sunday", entries: [{ songId, key: "G" }] });
    await admin.client.mutation(api.setlists.setCurrent, { groupId, setlistId });
    await admin.client.mutation(api.setlists.setCurrent, { groupId, setlistId });
    await admin.client.mutation(api.setlists.setCurrent, { groupId, setlistId: null });
    await admin.client.mutation(api.setlists.deleteSetlist, { setlistId });
    expect(await summaries("setlist")).toEqual([
      "Deleted the Setlist Sunday",
      "Cleared Sunday as the Current setlist",
      "Made Sunday the Current setlist",
      "Edited the Setlist Sunday",
      "Added the Setlist Sunday",
    ]);
    expect((await latest(admin.client, "setlist"))[3].details).toEqual(["Added Demo as number 1"]);
  });

  it("records Member and Group changes", async () => {
    const { as, admin, member, groupId, joinCode, summaries } = await setupGroup();
    await admin.client.mutation(api.groups.rename, { groupId, name: "Band B" });
    await admin.client.mutation(api.groups.setRole, { groupId, userId: member.userId, role: "songManager" });
    await admin.client.mutation(api.groups.setJoinRole, { groupId, joinRole: "playbackManager" });
    const guest = await as({ isAnonymous: true });
    await guest.client.mutation(api.groups.joinGroup, { joinCode, displayName: "Casey" });
    await admin.client.mutation(api.groups.setMemberName, { groupId, userId: guest.userId, displayName: "Casey B" });
    await member.client.mutation(api.groups.setDisplayName, { groupId, displayName: "Blake B" });
    await admin.client.mutation(api.groups.removeMember, { groupId, userId: guest.userId });
    await member.client.mutation(api.groups.leaveGroup, { groupId });
    expect(await summaries("group")).toEqual([
      "Left the Group",
      "Removed Casey B",
      "Changed their name from Blake",
      "Renamed Casey to Casey B",
      "Joined as a Guest with the Playback Manager Role",
      "New Members now join as Playback Managers",
      "Made Blake a Song Manager",
      "Renamed the Group from Band to Band B",
      "Joined as a Member",
      "Created the Group",
    ]);
  });

  it("keeps nothing for My Library", async () => {
    const { admin } = await setupGroup();
    const libraryId: Id<"groups"> = await admin.client.mutation(api.groups.openOffline, {});
    await admin.client.mutation(api.songs.createSong, { groupId: libraryId, title: "Solo" });
    const result = await admin.client.query(api.activity.list, { groupId: libraryId, paginationOpts: { numItems: 5, cursor: null } });
    expect(result.page).toEqual([]);
  });

  it("is forgotten with its Group", async () => {
    const { t, admin, groupId } = await setupGroup();
    await admin.client.mutation(api.groups.deleteGroup, { groupId });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(await t.run((ctx) => ctx.db.query("activity").collect())).toEqual([]);
  });
});
