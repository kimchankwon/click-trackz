/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

import { api, internal } from "./_generated/api";
import schema from "./schema";
import { demoSong } from "../src/sync/demo-song";

const modules = import.meta.glob("./**/*.ts");

async function setup() {
  const t = convexTest(schema, modules);
  const as = async (profile: { email?: string; isAnonymous?: boolean }) => {
    const userId = await t.run((ctx) => ctx.db.insert("users", profile));
    return { userId, client: t.withIdentity({ subject: `${userId}|session` }) };
  };
  return { t, as };
}

describe("Role permissions", () => {
  async function bandWithRoles() {
    const { as } = await setup();
    const admin = await as({ email: "admin@example.com" });
    const { groupId, joinCode } = await admin.client.mutation(api.groups.createGroup, { name: "Band", displayName: "A" });
    const join = async (email: string, role: "songManager" | "playbackManager" | "member") => {
      const person = await as({ email });
      await person.client.mutation(api.groups.joinGroup, { joinCode, displayName: email });
      if (role !== "member") await admin.client.mutation(api.groups.setRole, { groupId, userId: person.userId, role });
      return person;
    };
    const songManager = await join("songs@example.com", "songManager");
    const playbackManager = await join("playback@example.com", "playbackManager");
    const member = await join("member@example.com", "member");
    const guest = await as({ isAnonymous: true });
    await guest.client.mutation(api.groups.joinGroup, { joinCode, displayName: "Guest" });
    const songId = await admin.client.mutation(api.songs.createSong, { groupId, title: "Pure" });
    await admin.client.mutation(api.songs.updateSong, { songId, sections: [...demoSong.sections] });
    const setlistId = await admin.client.mutation(api.setlists.createSetlist, { groupId, name: "Sunday" });
    await admin.client.mutation(api.setlists.setCurrent, { groupId, setlistId });
    return { admin, songManager, playbackManager, member, guest, groupId, songId, setlistId };
  }

  it("lets Song Managers edit Songs and Setlists and steer Playback", async () => {
    const { songManager, groupId, songId, setlistId } = await bandWithRoles();
    await songManager.client.mutation(api.songs.updateSong, { songId, title: "Pure (live)" });
    await songManager.client.mutation(api.songs.createSong, { groupId, title: "Remembrance" });
    await songManager.client.mutation(api.setlists.save, { setlistId, revision: 0, name: "Sunday AM", entries: [{ songId }] });
    await songManager.client.mutation(api.playback.start, { groupId, songId });
    await songManager.client.mutation(api.playback.stop, { groupId });
    await expect(songManager.client.mutation(api.groups.rename, { groupId, name: "Mine" })).rejects.toThrow(/Only Group Managers and above/);
  });

  it("lets Playback Managers only start, steer and stop Playback", async () => {
    const { playbackManager, groupId, songId } = await bandWithRoles();
    await playbackManager.client.mutation(api.playback.start, { groupId, songId });
    await playbackManager.client.mutation(api.playback.jump, { groupId, toSection: 1, mode: "nextBar" });
    await playbackManager.client.mutation(api.playback.stop, { groupId });
    await expect(playbackManager.client.mutation(api.songs.updateSong, { songId, title: "x" })).rejects.toThrow(/Only Song Managers and above/);
    await expect(playbackManager.client.mutation(api.setlists.createSetlist, { groupId, name: "x" })).rejects.toThrow(/Only Song Managers and above/);
  });

  it("lets Members see the Songs and Setlists but change nothing", async () => {
    const { member, groupId, songId } = await bandWithRoles();
    expect((await member.client.query(api.songs.list, { groupId })).map((song) => song.title)).toEqual(["Pure"]);
    expect((await member.client.query(api.setlists.list, { groupId })).map((setlist) => setlist.name)).toEqual(["Sunday"]);
    await expect(member.client.mutation(api.playback.start, { groupId, songId })).rejects.toThrow(/Only Playback Managers and above/);
  });

  it("keeps the Song library and Setlists from guests, while Play still shows what is playing", async () => {
    const { admin, guest, groupId, songId, setlistId } = await bandWithRoles();
    await expect(guest.client.query(api.songs.list, { groupId })).rejects.toThrow(/Sign in with Google to see/);
    await expect(guest.client.query(api.setlists.list, { groupId })).rejects.toThrow(/Sign in with Google to see/);
    await admin.client.mutation(api.playback.start, { groupId, songId });
    expect(await guest.client.query(api.playback.current, { groupId })).toMatchObject({ songId });
    expect(await guest.client.query(api.songs.get, { songId })).toMatchObject({ title: "Pure" });
    expect(await guest.client.query(api.setlists.currentSetlistId, { groupId })).toBe(setlistId);
  });
});

describe("Copying a Song to another Group", () => {
  it("copies a Song with its Sections into another Group where the copier is a Song Manager", async () => {
    const { as } = await setup();
    const admin = await as({ email: "admin@example.com" });
    const band = await admin.client.mutation(api.groups.createGroup, { name: "Band", displayName: "A" });
    const choir = await admin.client.mutation(api.groups.createGroup, { name: "Choir", displayName: "A" });
    const songId = await admin.client.mutation(api.songs.createSong, { groupId: band.groupId, title: "Pure", key: "E" });
    await admin.client.mutation(api.songs.updateSong, { songId, sections: [...demoSong.sections], cueLeadBars: 1 });

    const copy = await admin.client.mutation(api.songs.copyToGroup, { songId, toGroupId: choir.groupId });
    expect(copy).toMatchObject({ title: "Pure", groupName: "Choir" });
    expect(await admin.client.query(api.songs.get, { songId: copy.songId })).toMatchObject({ key: "E", cueLeadBars: 1, sections: demoSong.sections });
    expect((await admin.client.mutation(api.songs.copyToGroup, { songId, toGroupId: choir.groupId })).title).toBe("Pure 2");
    await expect(admin.client.mutation(api.songs.copyToGroup, { songId, toGroupId: band.groupId })).rejects.toThrow(/already in this Group/);
  });

  it("copies between My Library and a Group", async () => {
    const { as } = await setup();
    const admin = await as({ email: "admin@example.com" });
    const band = await admin.client.mutation(api.groups.createGroup, { name: "Band", displayName: "A" });
    const libraryId = await admin.client.mutation(api.groups.openOffline, {});
    const practice = await admin.client.mutation(api.songs.createSong, { groupId: libraryId, title: "Etude" });
    await admin.client.mutation(api.songs.copyToGroup, { songId: practice, toGroupId: band.groupId });
    const bandSong = await admin.client.mutation(api.songs.createSong, { groupId: band.groupId, title: "Pure" });
    await admin.client.mutation(api.songs.copyToGroup, { songId: bandSong, toGroupId: libraryId });
    expect((await admin.client.query(api.songs.list, { groupId: libraryId })).map((song) => song.title)).toEqual(["Etude", "Pure"]);
  });

  it("needs Song Manager or above in both Groups", async () => {
    const { as } = await setup();
    const owner = await as({ email: "owner@example.com" });
    const band = await owner.client.mutation(api.groups.createGroup, { name: "Band", displayName: "O" });
    const copier = await as({ email: "copier@example.com" });
    const choir = await copier.client.mutation(api.groups.createGroup, { name: "Choir", displayName: "C" });
    await copier.client.mutation(api.groups.joinGroup, { joinCode: band.joinCode, displayName: "C" });
    const songId = await owner.client.mutation(api.songs.createSong, { groupId: band.groupId, title: "Pure" });
    await expect(copier.client.mutation(api.songs.copyToGroup, { songId, toGroupId: choir.groupId })).rejects.toThrow(/Only Song Managers and above/);
    await owner.client.mutation(api.groups.setRole, { groupId: band.groupId, userId: copier.userId, role: "songManager" });
    await copier.client.mutation(api.songs.copyToGroup, { songId, toGroupId: choir.groupId });
    await expect(owner.client.mutation(api.songs.copyToGroup, { songId, toGroupId: choir.groupId })).rejects.toThrow(/not in this Group/);
  });
});

describe("My Library", () => {
  it("lets a guest list the Songs and Setlists of their own My Library", async () => {
    const { as } = await setup();
    const guest = await as({ isAnonymous: true });
    const libraryId = await guest.client.mutation(api.groups.openOffline, {});
    await guest.client.mutation(api.songs.createSong, { groupId: libraryId, title: "Etude" });
    expect((await guest.client.query(api.songs.list, { groupId: libraryId })).map((song) => song.title)).toEqual(["Etude"]);
    expect(await guest.client.query(api.setlists.list, { groupId: libraryId })).toEqual([]);
  });

  it("hands its owner My Library in one read to keep on the device, and nobody else", async () => {
    const { as } = await setup();
    const daniel = await as({ email: "daniel@example.com" });
    const libraryId = await daniel.client.mutation(api.groups.openOffline, {});
    const songId = await daniel.client.mutation(api.songs.createSong, { groupId: libraryId, title: "Etude" });
    const setlistId = await daniel.client.mutation(api.setlists.createSetlist, { groupId: libraryId, name: "Practice" });
    await daniel.client.mutation(api.setlists.save, { setlistId, revision: 0, name: "Practice", entries: [{ songId, key: "A" }] });
    await daniel.client.mutation(api.setlists.setCurrent, { groupId: libraryId, setlistId });
    expect(await daniel.client.query(api.library.snapshot, { groupId: libraryId })).toMatchObject({
      groupId: libraryId,
      name: "My Library",
      currentSetlistId: setlistId,
      songs: [{ songId, title: "Etude", sections: [] }],
      setlists: [{ setlistId, name: "Practice", revision: 1, entries: [{ songId, key: "A", leader: null }] }],
    });
    const band = await daniel.client.mutation(api.groups.createGroup, { name: "Band", displayName: "D" });
    await expect(daniel.client.query(api.library.snapshot, { groupId: band.groupId })).rejects.toThrow(/Only My Library/);
    const other = await as({ email: "other@example.com" });
    await expect(other.client.query(api.library.snapshot, { groupId: libraryId })).rejects.toThrow(/not in this Group/);
  });

  it("counts every My Library edit so devices know when their copy is out of date", async () => {
    const { as } = await setup();
    const daniel = await as({ email: "daniel@example.com" });
    const libraryId = await daniel.client.mutation(api.groups.openOffline, {});
    const revision = () => daniel.client.query(api.library.revision, { groupId: libraryId });
    expect(await revision()).toBe(0);
    const songId = await daniel.client.mutation(api.songs.createSong, { groupId: libraryId, title: "Etude" });
    await daniel.client.mutation(api.songs.updateSong, { songId, bpm: 90 });
    const setlistId = await daniel.client.mutation(api.setlists.createSetlist, { groupId: libraryId, name: "Practice" });
    await daniel.client.mutation(api.setlists.setCurrent, { groupId: libraryId, setlistId });
    await daniel.client.mutation(api.setlists.deleteSetlist, { setlistId });
    await daniel.client.mutation(api.songs.deleteSong, { songId });
    expect(await revision()).toBe(6);
    expect((await daniel.client.query(api.library.snapshot, { groupId: libraryId })).revision).toBe(6);
    const band = await daniel.client.mutation(api.groups.createGroup, { name: "Band", displayName: "D" });
    await daniel.client.mutation(api.songs.createSong, { groupId: band.groupId, title: "Pure" });
    expect(await daniel.client.query(api.library.revision, { groupId: band.groupId })).toBeNull();
  });
});

describe("Migrating to one Admin per Group", () => {
  it("keeps the creator as Admin, makes other Admins Group Managers and renames Offline to My Library", async () => {
    const { t } = await setup();
    const result = await t.run(async (ctx) => {
      const creator = await ctx.db.insert("users", { email: "creator@example.com" });
      const second = await ctx.db.insert("users", { email: "second@example.com" });
      const member = await ctx.db.insert("users", { email: "member@example.com" });
      const groupId = await ctx.db.insert("groups", { name: "Band", joinCode: "AAAAAA", createdBy: creator });
      for (const [userId, role] of [
        [creator, "admin"],
        [second, "admin"],
        [member, "member"],
      ] as const) {
        await ctx.db.insert("memberships", { groupId, userId, role, displayName: "x" });
      }
      const libraryId = await ctx.db.insert("groups", { name: "Offline", joinCode: "BBBBBB", createdBy: member, offline: true });
      return { groupId, libraryId, creator, second, member };
    });
    expect(await t.mutation(internal.migrations.oneAdminPerGroup, {})).toEqual({ demoted: 1, newOwners: 0, renamedLibraries: 1 });
    const roles = await t.run(async (ctx) => (await ctx.db.query("memberships").collect()).map((membership) => [membership.userId, membership.role]));
    expect(roles).toEqual([
      [result.creator, "admin"],
      [result.second, "groupManager"],
      [result.member, "member"],
    ]);
    expect((await t.run((ctx) => ctx.db.get(result.libraryId)))?.name).toBe("My Library");
  });

  it("hands a Group whose creator left to its longest-standing Admin", async () => {
    const { t } = await setup();
    const { groupId, first, later } = await t.run(async (ctx) => {
      const creator = await ctx.db.insert("users", { email: "gone@example.com" });
      const first = await ctx.db.insert("users", { email: "first@example.com" });
      const later = await ctx.db.insert("users", { email: "later@example.com" });
      const groupId = await ctx.db.insert("groups", { name: "Band", joinCode: "AAAAAA", createdBy: creator });
      await ctx.db.insert("memberships", { groupId, userId: first, role: "admin", displayName: "First" });
      await ctx.db.insert("memberships", { groupId, userId: later, role: "admin", displayName: "Later" });
      return { groupId, first, later };
    });
    expect(await t.mutation(internal.migrations.oneAdminPerGroup, {})).toMatchObject({ demoted: 1, newOwners: 1 });
    expect((await t.run((ctx) => ctx.db.get(groupId)))?.createdBy).toBe(first);
    const roles = await t.run(async (ctx) => (await ctx.db.query("memberships").collect()).map((membership) => [membership.userId, membership.role]));
    expect(roles).toEqual([
      [first, "admin"],
      [later, "groupManager"],
    ]);
  });
});
