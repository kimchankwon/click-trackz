/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

async function setup() {
  const t = convexTest(schema, modules);
  const as = async (profile: { email?: string; isAnonymous?: boolean }) => {
    const userId = await t.run((ctx) => ctx.db.insert("users", profile));
    return { userId, client: t.withIdentity({ subject: `${userId}|session` }) };
  };
  return { t, as };
}

describe("Groups", () => {
  it("makes the creator, who must have a real account, the first Admin", async () => {
    const { as } = await setup();
    const daniel = await as({ email: "daniel@example.com" });
    const { groupId, joinCode } = await daniel.client.mutation(api.groups.createGroup, {
      name: "Sunday band",
      displayName: "Daniel",
    });
    expect(joinCode).toMatch(/^[A-Z2-9]{6}$/);
    const members = await daniel.client.query(api.groups.members, { groupId });
    expect(members).toEqual([expect.objectContaining({ displayName: "Daniel", role: "admin", isGuest: false })]);

    const guest = await as({ isAnonymous: true });
    await expect(guest.client.mutation(api.groups.createGroup, { name: "x", displayName: "G" })).rejects.toThrow(
      /Sign in with Google to create a Group/,
    );
  });

  it("lets the Admin or a Group Manager rename the Group, which every Member sees and which resets the copy name", async () => {
    const { t, as } = await setup();
    const daniel = await as({ email: "daniel@example.com" });
    const { groupId, joinCode } = await daniel.client.mutation(api.groups.createGroup, { name: "Band", displayName: "Daniel" });
    const guest = await as({ isAnonymous: true });
    await guest.client.mutation(api.groups.joinGroup, { joinCode, displayName: "Jisue" });
    await t.run((ctx) => ctx.db.patch(groupId, { copyBase: "Band" }));
    await daniel.client.mutation(api.groups.rename, { groupId, name: "  Sunday band  " });
    expect((await guest.client.query(api.groups.myGroups, {}))[0]).toMatchObject({ groupId, name: "Sunday band", copyBase: null });
    await expect(guest.client.mutation(api.groups.rename, { groupId, name: "Mine" })).rejects.toThrow(/Only Group Managers and above/);
    await expect(daniel.client.mutation(api.groups.rename, { groupId, name: "   " })).rejects.toThrow(/Group name must be 1 to 40/);
    const joanne = await as({ email: "joanne@example.com" });
    await joanne.client.mutation(api.groups.joinGroup, { joinCode, displayName: "Joanne" });
    await daniel.client.mutation(api.groups.setRole, { groupId, userId: joanne.userId, role: "groupManager" });
    await joanne.client.mutation(api.groups.rename, { groupId, name: "Evening band" });
    expect((await daniel.client.query(api.groups.myGroups, {}))[0]).toMatchObject({ name: "Evening band" });
    const libraryId = await daniel.client.mutation(api.groups.openOffline, {});
    await expect(daniel.client.mutation(api.groups.rename, { groupId: libraryId, name: "Me" })).rejects.toThrow(/My Library cannot be renamed/);
  });

  it("lets only the Admin delete a Group with everything in it, and never My Library", async () => {
    const { t, as } = await setup();
    const daniel = await as({ email: "daniel@example.com" });
    const { groupId, joinCode } = await daniel.client.mutation(api.groups.createGroup, { name: "Band", displayName: "Daniel" });
    const guest = await as({ isAnonymous: true });
    await guest.client.mutation(api.groups.joinGroup, { joinCode, displayName: "Jisue" });
    const songId = await daniel.client.mutation(api.songs.createSong, { groupId, title: "Pure" });
    await daniel.client.mutation(api.setlists.createSetlist, { groupId, name: "Sunday" });
    await guest.client.mutation(api.presence.heartbeat, { groupId, screenId: "s1", onPlay: false });
    await expect(guest.client.mutation(api.groups.deleteGroup, { groupId })).rejects.toThrow(/Only the Admin/);
    await daniel.client.mutation(api.groups.deleteGroup, { groupId });
    expect(await t.run((ctx) => ctx.db.get(groupId))).toBeNull();
    expect(await t.run((ctx) => ctx.db.get(songId))).toBeNull();
    for (const table of ["memberships", "setlists", "presence"] as const) expect(await t.run((ctx) => ctx.db.query(table).collect())).toEqual([]);
    expect(await guest.client.query(api.groups.myGroups, {})).toEqual([]);
    await expect(guest.client.query(api.groups.members, { groupId })).rejects.toThrow(/not in this Group/);
    const libraryId = await daniel.client.mutation(api.groups.openOffline, {});
    await expect(daniel.client.mutation(api.groups.deleteGroup, { groupId: libraryId })).rejects.toThrow(/My Library cannot be deleted/);
  });

  it("lets anyone signed in, guests included, join with the code, once", async () => {
    const { as } = await setup();
    const daniel = await as({ email: "daniel@example.com" });
    const { groupId, joinCode } = await daniel.client.mutation(api.groups.createGroup, { name: "Band", displayName: "Daniel" });
    const guest = await as({ isAnonymous: true });
    expect(await guest.client.mutation(api.groups.joinGroup, { joinCode: joinCode.toLowerCase(), displayName: "Jisue" })).toBe(groupId);
    expect(await guest.client.mutation(api.groups.joinGroup, { joinCode, displayName: "Jisue" })).toBe(groupId);
    const members = await guest.client.query(api.groups.members, { groupId });
    expect(members.map((m) => [m.displayName, m.role, m.isGuest])).toEqual([
      ["Daniel", "admin", false],
      ["Jisue", "member", true],
    ]);
    await expect(guest.client.mutation(api.groups.joinGroup, { joinCode: "ZZZZZZ", displayName: "J" })).rejects.toThrow(/No Group/);
  });

  it("gives each person, guests included, one My Library that only they are in and no one can join", async () => {
    const { t, as } = await setup();
    const guest = await as({ isAnonymous: true });
    const offlineId = await guest.client.mutation(api.groups.openOffline, {});
    expect(await guest.client.mutation(api.groups.openOffline, {})).toBe(offlineId);
    expect(await guest.client.query(api.groups.myGroups, {})).toEqual([
      { groupId: offlineId, name: "My Library", role: "admin", offline: true, copyBase: null, guest: true, owned: true, joinCode: null },
    ]);
    expect(await guest.client.query(api.groups.members, { groupId: offlineId })).toEqual([
      expect.objectContaining({ displayName: "You", role: "admin" }),
    ]);

    const daniel = await as({ email: "daniel@example.com" });
    expect(await daniel.client.mutation(api.groups.openOffline, {})).not.toBe(offlineId);
    const { joinCode } = await daniel.client.mutation(api.groups.createGroup, { name: "Band", displayName: "Daniel" });
    expect((await daniel.client.query(api.groups.myGroups, {})).map((g) => [g.name, g.offline, g.joinCode])).toEqual([
      ["My Library", true, null],
      ["Band", false, joinCode],
    ]);
    const offlineCode = await t.run(async (ctx) => (await ctx.db.get(offlineId))?.joinCode ?? "");
    await expect(daniel.client.mutation(api.groups.joinGroup, { joinCode: offlineCode, displayName: "Daniel" })).rejects.toThrow(/No Group/);
  });

  it("lets the Admin hand out every Role below Admin, and Group Managers only Song Manager and below", async () => {
    const { as } = await setup();
    const daniel = await as({ email: "daniel@example.com" });
    const { groupId, joinCode } = await daniel.client.mutation(api.groups.createGroup, { name: "Band", displayName: "Daniel" });
    const joanne = await as({ email: "joanne@example.com" });
    const mia = await as({ email: "mia@example.com" });
    const guest = await as({ isAnonymous: true });
    await joanne.client.mutation(api.groups.joinGroup, { joinCode, displayName: "Joanne" });
    await mia.client.mutation(api.groups.joinGroup, { joinCode, displayName: "Mia" });
    await guest.client.mutation(api.groups.joinGroup, { joinCode, displayName: "Minwoo" });

    await expect(joanne.client.mutation(api.groups.setRole, { groupId, userId: mia.userId, role: "songManager" })).rejects.toThrow(/Only Group Managers and above/);
    await expect(daniel.client.mutation(api.groups.setRole, { groupId, userId: joanne.userId, role: "admin" })).rejects.toThrow(/created the Group can be its Admin/);
    await expect(daniel.client.mutation(api.groups.setRole, { groupId, userId: guest.userId, role: "playbackManager" })).rejects.toThrow(/Guests must sign in with Google/);
    await expect(daniel.client.mutation(api.groups.setRole, { groupId, userId: daniel.userId, role: "member" })).rejects.toThrow(/your own Role/);

    await daniel.client.mutation(api.groups.setRole, { groupId, userId: joanne.userId, role: "groupManager" });
    await joanne.client.mutation(api.groups.setRole, { groupId, userId: mia.userId, role: "songManager" });
    await expect(joanne.client.mutation(api.groups.setRole, { groupId, userId: mia.userId, role: "groupManager" })).rejects.toThrow(/Roles below your own/);
    await expect(joanne.client.mutation(api.groups.setRole, { groupId, userId: daniel.userId, role: "member" })).rejects.toThrow(/Roles below your own/);
    await joanne.client.mutation(api.groups.setRole, { groupId, userId: mia.userId, role: "playbackManager" });

    const roles = (await joanne.client.query(api.groups.members, { groupId })).map((m) => [m.displayName, m.role]);
    expect(roles).toEqual([
      ["Daniel", "admin"],
      ["Joanne", "groupManager"],
      ["Mia", "playbackManager"],
      ["Minwoo", "member"],
    ]);
    await guest.client.mutation(api.groups.leaveGroup, { groupId });
    await expect(guest.client.query(api.groups.members, { groupId })).rejects.toThrow(/not in this Group/);
  });

  it("keeps the Admin in their own Group, which they can only delete", async () => {
    const { as } = await setup();
    const daniel = await as({ email: "daniel@example.com" });
    const { groupId } = await daniel.client.mutation(api.groups.createGroup, { name: "Band", displayName: "Daniel" });
    await expect(daniel.client.mutation(api.groups.leaveGroup, { groupId })).rejects.toThrow(/Admin cannot leave/);
  });

  it("lets Group Managers rename and remove people below them, but not those at or above them", async () => {
    const { as } = await setup();
    const daniel = await as({ email: "daniel@example.com" });
    const { groupId, joinCode } = await daniel.client.mutation(api.groups.createGroup, { name: "Band", displayName: "Daniel" });
    const joanne = await as({ email: "joanne@example.com" });
    const mia = await as({ email: "mia@example.com" });
    await joanne.client.mutation(api.groups.joinGroup, { joinCode, displayName: "Joanne" });
    await mia.client.mutation(api.groups.joinGroup, { joinCode, displayName: "Mia" });
    await daniel.client.mutation(api.groups.setRole, { groupId, userId: joanne.userId, role: "groupManager" });

    await joanne.client.mutation(api.groups.setMemberName, { groupId, userId: mia.userId, displayName: "Mia (keys)" });
    await expect(joanne.client.mutation(api.groups.setMemberName, { groupId, userId: daniel.userId, displayName: "D" })).rejects.toThrow(/rename people below you/);
    await expect(mia.client.mutation(api.groups.setMemberName, { groupId, userId: joanne.userId, displayName: "J" })).rejects.toThrow(/Only Group Managers and above/);
    await expect(joanne.client.mutation(api.groups.removeMember, { groupId, userId: daniel.userId })).rejects.toThrow(/remove people below you/);
    expect((await mia.client.query(api.groups.members, { groupId })).map((m) => m.displayName)).toEqual(["Daniel", "Joanne", "Mia (keys)"]);
    await joanne.client.mutation(api.groups.removeMember, { groupId, userId: mia.userId });
    await expect(mia.client.query(api.groups.members, { groupId })).rejects.toThrow(/not in this Group/);
  });

  it("shows the join code to the Admin and Group Managers only", async () => {
    const { as } = await setup();
    const daniel = await as({ email: "daniel@example.com" });
    const { groupId, joinCode } = await daniel.client.mutation(api.groups.createGroup, { name: "Band", displayName: "Daniel" });
    const joanne = await as({ email: "joanne@example.com" });
    await joanne.client.mutation(api.groups.joinGroup, { joinCode, displayName: "Joanne" });
    await daniel.client.mutation(api.groups.setRole, { groupId, userId: joanne.userId, role: "songManager" });
    expect((await joanne.client.query(api.groups.myGroups, {}))[0]).toMatchObject({ owned: false, joinCode: null });
    expect((await daniel.client.query(api.groups.myGroups, {}))[0]).toMatchObject({ owned: true });
    await daniel.client.mutation(api.groups.setRole, { groupId, userId: joanne.userId, role: "groupManager" });
    expect((await joanne.client.query(api.groups.myGroups, {}))[0].joinCode).toBe(joinCode);
  });

  it("lets an Admin remove another Member, who then loses access", async () => {
    const { as } = await setup();
    const admin = await as({ email: "admin@example.com" });
    const { groupId, joinCode } = await admin.client.mutation(api.groups.createGroup, { name: "Band", displayName: "Admin" });
    const jason = await as({ isAnonymous: true });
    await jason.client.mutation(api.groups.joinGroup, { joinCode, displayName: "Jason" });
    await jason.client.mutation(api.presence.heartbeat, { groupId, screenId: "phone", onPlay: true });
    await admin.client.mutation(api.groups.removeMember, { groupId, userId: jason.userId });
    expect(await admin.client.query(api.groups.members, { groupId })).toEqual([expect.objectContaining({ displayName: "Admin" })]);
    expect(await admin.client.query(api.presence.list, { groupId })).toEqual([]);
    await expect(jason.client.query(api.groups.members, { groupId })).rejects.toThrow(/not in this Group/);
  });

  it("only lets Group Managers and above remove people, and not themselves", async () => {
    const { as } = await setup();
    const admin = await as({ email: "admin@example.com" });
    const { groupId, joinCode } = await admin.client.mutation(api.groups.createGroup, { name: "Band", displayName: "Admin" });
    const jason = await as({ isAnonymous: true });
    await jason.client.mutation(api.groups.joinGroup, { joinCode, displayName: "Jason" });
    await expect(jason.client.mutation(api.groups.removeMember, { groupId, userId: admin.userId })).rejects.toThrow(/Only Group Managers and above/);
    await expect(admin.client.mutation(api.groups.removeMember, { groupId, userId: admin.userId })).rejects.toThrow(/Leave Group/);
  });
});

describe("Duplicate Group", () => {
  it("copies every Song and Setlist into a new Group with only the Admin who copied it", async () => {
    const { as } = await setup();
    const daniel = await as({ email: "daniel@example.com" });
    const { groupId, joinCode } = await daniel.client.mutation(api.groups.createGroup, { name: "Band", displayName: "Daniel" });
    const mia = await as({ isAnonymous: true });
    await mia.client.mutation(api.groups.joinGroup, { joinCode, displayName: "Mia" });
    const verse = { sectionType: "Verse", bars: 8, beatsPerBar: 4, bpm: 72 };
    const remembrance = await daniel.client.mutation(api.songs.createSong, { groupId, title: "Remembrance", key: "E" });
    await daniel.client.mutation(api.songs.updateSong, { songId: remembrance, cueLeadBars: 1, sections: [verse] });
    const pure = await daniel.client.mutation(api.songs.createSong, { groupId, title: "Pure" });
    const sunday = await daniel.client.mutation(api.setlists.createSetlist, { groupId, name: "Sunday" });
    await daniel.client.mutation(api.setlists.save, {
      setlistId: sunday,
      name: "Sunday",
      entries: [{ songId: pure }, { songId: remembrance, key: "F", leader: "Mia" }],
      revision: 0,
    });
    await daniel.client.mutation(api.setlists.setCurrent, { groupId, setlistId: sunday });

    const copy = await daniel.client.mutation(api.groups.duplicateGroup, { groupId });
    expect(copy.name).toBe("Band 2");
    expect(await daniel.client.query(api.groups.members, { groupId: copy.groupId })).toEqual([
      expect.objectContaining({ displayName: "Daniel", role: "admin" }),
    ]);
    const myGroups = await daniel.client.query(api.groups.myGroups, {});
    const copied = myGroups.find((group) => group.groupId === copy.groupId);
    expect(copied?.joinCode).toMatch(/^[A-Z2-9]{6}$/);
    expect(copied?.joinCode).not.toBe(joinCode);

    const songs = await daniel.client.query(api.songs.list, { groupId: copy.groupId });
    expect(songs.map((song) => song.title)).toEqual(["Remembrance", "Pure"]);
    const copiedRemembrance = songs.find((song) => song.title === "Remembrance")!;
    expect(copiedRemembrance.songId).not.toBe(remembrance);
    expect(await daniel.client.query(api.songs.get, { songId: copiedRemembrance.songId })).toMatchObject({ key: "E", cueLeadBars: 1, sections: [verse] });

    const currentId = await daniel.client.query(api.setlists.currentSetlistId, { groupId: copy.groupId });
    const current = await daniel.client.query(api.setlists.get, { setlistId: currentId! });
    expect(current?.name).toBe("Sunday");
    expect(current?.entries.map((entry) => [entry.title, entry.key, entry.leader])).toEqual([
      ["Pure", null, null],
      ["Remembrance", "F", "Mia"],
    ]);
    expect(current?.entries.every((entry) => songs.some((song) => song.songId === entry.songId))).toBe(true);

    expect((await daniel.client.mutation(api.groups.duplicateGroup, { groupId: copy.groupId })).name).toBe("Band 3");
    await expect(mia.client.mutation(api.groups.duplicateGroup, { groupId })).rejects.toThrow(/Only Group Managers and above/);
    await expect(mia.client.query(api.songs.list, { groupId: copy.groupId })).rejects.toThrow(/not in this Group/);
  });
});

describe("Your name in a Group", () => {
  it("lets a Member change only their own name, in that Group only", async () => {
    const { as } = await setup();
    const daniel = await as({ email: "daniel@example.com" });
    const guest = await as({ isAnonymous: true });
    const { groupId, joinCode } = await daniel.client.mutation(api.groups.createGroup, { name: "Band", displayName: "Daniel" });
    const other = await daniel.client.mutation(api.groups.createGroup, { name: "Choir", displayName: "Daniel" });
    await guest.client.mutation(api.groups.joinGroup, { joinCode, displayName: "Jisue" });

    await guest.client.mutation(api.groups.setDisplayName, { groupId, displayName: "  Jisue K  " });
    await daniel.client.mutation(api.groups.setDisplayName, { groupId, displayName: "Dan" });

    const names = (await daniel.client.query(api.groups.members, { groupId })).map((m) => m.displayName).sort();
    expect(names).toEqual(["Dan", "Jisue K"]);
    expect((await daniel.client.query(api.groups.members, { groupId: other.groupId })).map((m) => m.displayName)).toEqual(["Daniel"]);
  });

  it("refuses an empty name and anyone outside the Group", async () => {
    const { as } = await setup();
    const daniel = await as({ email: "daniel@example.com" });
    const stranger = await as({ isAnonymous: true });
    const { groupId } = await daniel.client.mutation(api.groups.createGroup, { name: "Band", displayName: "Daniel" });
    await expect(daniel.client.mutation(api.groups.setDisplayName, { groupId, displayName: "   " })).rejects.toThrow(/1 to 40 characters/);
    await expect(stranger.client.mutation(api.groups.setDisplayName, { groupId, displayName: "Sneaky" })).rejects.toThrow(/not in this Group/);
  });
});
