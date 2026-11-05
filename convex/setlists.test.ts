// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

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
  const song = (title: string) => admin.mutation(api.songs.createSong, { groupId, title });
  return { t, as, admin, member, groupId, song };
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
    await expect(member.mutation(api.setlists.createSetlist, { groupId, name: "x" })).rejects.toThrow(/Only Admins/);
    await expect(member.mutation(api.setlists.setCurrent, { groupId, setlistId })).rejects.toThrow(/Only Admins/);
  });

  it("keeps an ordered list of the Group's Songs with an optional Key and Leader for each", async () => {
    const { as, admin, member, groupId, song } = await setupGroup();
    const pure = await song("Pure");
    const promises = await song("Promises");
    const setlistId = await admin.mutation(api.setlists.createSetlist, { groupId, name: "Sunday" });
    await admin.mutation(api.setlists.setEntries, {
      setlistId,
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
    await expect(admin.mutation(api.setlists.setEntries, { setlistId, entries: [{ songId: foreign }] })).rejects.toThrow(/not in this Group/);
    await expect(member.mutation(api.setlists.setEntries, { setlistId, entries: [] })).rejects.toThrow(/Only Admins/);
  });

  it("drops a deleted Song from every Setlist and forgets a deleted current Setlist", async () => {
    const { admin, member, groupId, song } = await setupGroup();
    const pure = await song("Pure");
    const promises = await song("Promises");
    const setlistId = await admin.mutation(api.setlists.createSetlist, { groupId, name: "Sunday" });
    await admin.mutation(api.setlists.setEntries, { setlistId, entries: [{ songId: pure }, { songId: promises }] });
    await admin.mutation(api.songs.deleteSong, { songId: pure });
    expect((await member.query(api.setlists.get, { setlistId }))?.entries.map((e) => e.title)).toEqual(["Promises"]);

    await admin.mutation(api.setlists.setCurrent, { groupId, setlistId });
    await admin.mutation(api.setlists.deleteSetlist, { setlistId });
    expect(await member.query(api.setlists.list, { groupId })).toEqual([]);
    expect(await member.query(api.setlists.currentSetlistId, { groupId })).toBeNull();
  });
});
