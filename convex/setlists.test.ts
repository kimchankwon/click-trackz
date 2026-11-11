/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

import { api, internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

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
  const member = await as({ email: "member@example.com" });
  await member.mutation(api.groups.joinGroup, { joinCode, displayName: "Member" });
  const guest = await as({ isAnonymous: true });
  await guest.mutation(api.groups.joinGroup, { joinCode, displayName: "Guest" });
  const song = (title: string) => admin.mutation(api.songs.createSong, { groupId, title });
  return { t, as, admin, member, guest, groupId, song };
}

describe("Setlists", () => {
  it("lets Admins create a Setlist and mark it current for every Member to see first", async () => {
    const { admin, member, groupId } = await setupGroup();
    const setlistId = await admin.mutation(api.setlists.createSetlist, { groupId, name: "Sunday" });
    expect(await member.query(api.setlists.list, { groupId })).toEqual([
      expect.objectContaining({ setlistId, name: "Sunday", isCurrent: false, songCount: 0 }),
    ]);
    await admin.mutation(api.setlists.setCurrent, { groupId, setlistId });
    expect((await member.query(api.setlists.list, { groupId }))[0].isCurrent).toBe(true);
    await expect(member.mutation(api.setlists.createSetlist, { groupId, name: "x" })).rejects.toThrow(/Only Song Managers and above/);
    await expect(member.mutation(api.setlists.setCurrent, { groupId, setlistId })).rejects.toThrow(/Only Song Managers and above/);
  });

  it("keeps an ordered list of the Group's Songs with an optional Key and Leader for each", async () => {
    const { as, admin, member, groupId, song } = await setupGroup();
    const pure = await song("Pure");
    const promises = await song("Promises");
    const setlistId = await admin.mutation(api.setlists.createSetlist, { groupId, name: "Sunday" });
    await admin.mutation(api.setlists.save, {
      setlistId,
      revision: 0,
      name: "Sunday",
      entries: [{ songId: promises, leader: "Minwoo" }, { songId: pure, key: "D", leader: "Jisue" }],
    });
    const setlist = await member.query(api.setlists.get, { setlistId });
    expect(setlist?.entries).toEqual([
      { songId: promises, title: "Promises", key: null, leader: "Minwoo", needsStructure: true },
      { songId: pure, title: "Pure", key: "D", leader: "Jisue", needsStructure: true },
    ]);

    const other = await as({ email: "other@example.com" });
    const { groupId: otherGroup } = await other.mutation(api.groups.createGroup, { name: "Other", displayName: "O" });
    const foreign = await other.mutation(api.songs.createSong, { groupId: otherGroup, title: "Foreign" });
    await expect(
      admin.mutation(api.setlists.save, { setlistId, revision: 1, name: "Sunday", entries: [{ songId: foreign }] }),
    ).rejects.toThrow(/not in this Group/);
    await expect(member.mutation(api.setlists.save, { setlistId, revision: 1, name: "Sunday", entries: [] })).rejects.toThrow(/Only Song Managers and above/);
  });

  it("drops a deleted Song from every Setlist and forgets a deleted current Setlist", async () => {
    const { admin, member, groupId, song } = await setupGroup();
    const pure = await song("Pure");
    const promises = await song("Promises");
    const setlistId = await admin.mutation(api.setlists.createSetlist, { groupId, name: "Sunday" });
    await admin.mutation(api.setlists.save, { setlistId, revision: 0, name: "Sunday", entries: [{ songId: pure }, { songId: promises }] });
    await admin.mutation(api.songs.deleteSong, { songId: pure });
    expect((await member.query(api.setlists.get, { setlistId }))?.entries.map((e) => e.title)).toEqual(["Promises"]);

    await admin.mutation(api.setlists.setCurrent, { groupId, setlistId });
    await admin.mutation(api.setlists.deleteSetlist, { setlistId });
    expect(await member.query(api.setlists.list, { groupId })).toEqual([]);
    expect(await member.query(api.setlists.currentSetlistId, { groupId })).toBeNull();
  });

  it("saves the name and Songs together, or neither when an entry is invalid", async () => {
    const { admin, member, groupId, song } = await setupGroup();
    const pure = await song("Pure");
    const setlistId = await admin.mutation(api.setlists.createSetlist, { groupId, name: "Sunday" });
    await expect(
      admin.mutation(api.setlists.save, { setlistId, revision: 0, name: "Easter", entries: [{ songId: pure, key: "D major with a capo on the second fret" }] }),
    ).rejects.toThrow(/Key must be 30 characters/);
    expect(await member.query(api.setlists.get, { setlistId })).toMatchObject({ name: "Sunday", entries: [], revision: 0 });
  });

  it("refuses a save from a form opened before another Song Manager's change", async () => {
    const { as, admin, member, groupId, song } = await setupGroup();
    const pure = await song("Pure");
    const promises = await song("Promises");
    const setlistId = await admin.mutation(api.setlists.createSetlist, { groupId, name: "Sunday" });
    const secondAdmin = await as({ email: "second@example.com" });
    const { joinCode } = (await admin.query(api.groups.myGroups, {}))[0];
    await secondAdmin.mutation(api.groups.joinGroup, { joinCode: joinCode!, displayName: "Second" });
    const secondId = (await admin.query(api.groups.members, { groupId })).find((m) => m.displayName === "Second")!.userId;
    await admin.mutation(api.groups.setRole, { groupId, userId: secondId, role: "songManager" });

    await secondAdmin.mutation(api.setlists.save, { setlistId, revision: 0, name: "Sunday", entries: [{ songId: promises }] });
    await expect(admin.mutation(api.setlists.save, { setlistId, revision: 0, name: "Sunday", entries: [{ songId: pure }] })).rejects.toThrow(
      /changed this Setlist/,
    );
    expect((await member.query(api.setlists.get, { setlistId }))?.entries.map((e) => e.title)).toEqual(["Promises"]);
    await admin.mutation(api.setlists.save, { setlistId, revision: 1, name: "Sunday", entries: [{ songId: promises }, { songId: pure }] });
    expect(await member.query(api.setlists.get, { setlistId })).toMatchObject({ revision: 2 });
  });

  it("gives a reused seed Song the researched tempo when it has none, and keeps one it already has", async () => {
    const { t, admin, groupId } = await setupGroup();
    const promises = await admin.mutation(api.songs.createSong, { groupId, title: "Promises" });
    const pure = await admin.mutation(api.songs.createSong, { groupId, title: "Pure" });
    await t.run((ctx) => ctx.db.patch(pure, { tempoHint: { bpm: 80, beatsPerBar: 4 } }));
    await t.mutation(internal.seed.firstSetlistForGroup, { groupId });
    const hints = await t.run(async (ctx) => [(await ctx.db.get(promises))?.tempoHint, (await ctx.db.get(pure))?.tempoHint]);
    expect(hints).toEqual([{ bpm: 258, beatsPerBar: 6 }, { bpm: 80, beatsPerBar: 4 }]);
  });
});
