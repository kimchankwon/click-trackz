/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { api, internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const NOW = 1_000_000;

async function setupGroup() {
  const t = convexTest(schema, modules);
  const as = async (profile: { email?: string; isAnonymous?: boolean }) => {
    const userId = await t.run((ctx) => ctx.db.insert("users", profile));
    return { userId, client: t.withIdentity({ subject: `${userId}|session` }) };
  };
  const admin = await as({ email: "admin@example.com" });
  const { groupId, joinCode } = await admin.client.mutation(api.groups.createGroup, { name: "Band", displayName: "Admin" });
  const member = await as({ isAnonymous: true });
  await member.client.mutation(api.groups.joinGroup, { joinCode, displayName: "Member" });
  const outsider = await as({ isAnonymous: true });
  return { t, admin, member, outsider, groupId };
}

describe("Presence", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => vi.useRealTimers());

  it("records each Member's latest heartbeat and whether they are on Play", async () => {
    const { admin, member, groupId } = await setupGroup();
    await member.client.mutation(api.presence.heartbeat, { groupId, screenId: "s1", onPlay: false });
    vi.setSystemTime(NOW + 5_000);
    await member.client.mutation(api.presence.heartbeat, { groupId, screenId: "s1", onPlay: true });
    expect(await admin.client.query(api.presence.list, { groupId })).toEqual([{ userId: member.userId, onPlay: true, seenAt: NOW + 5_000, roundTripMs: null }]);
  });

  it("forgets a Member who leaves the screen or the Group", async () => {
    const { admin, member, groupId } = await setupGroup();
    await admin.client.mutation(api.presence.heartbeat, { groupId, screenId: "s1", onPlay: true });
    await member.client.mutation(api.presence.heartbeat, { groupId, screenId: "s1", onPlay: true });
    await admin.client.mutation(api.presence.leave, { groupId, screenId: "s1" });
    await member.client.mutation(api.groups.leaveGroup, { groupId });
    await admin.client.mutation(api.presence.heartbeat, { groupId, screenId: "s1", onPlay: false });
    expect(await admin.client.query(api.presence.list, { groupId })).toEqual([expect.objectContaining({ userId: admin.userId, onPlay: false })]);
  });

  it("lets a screen say it closed after its Member already left the Group", async () => {
    const { admin, member, groupId } = await setupGroup();
    await member.client.mutation(api.presence.heartbeat, { groupId, screenId: "s1", onPlay: true });
    await member.client.mutation(api.groups.leaveGroup, { groupId });
    await expect(member.client.mutation(api.presence.leave, { groupId, screenId: "s1" })).resolves.toBeNull();
    expect(await admin.client.query(api.presence.list, { groupId })).toEqual([]);
  });

  it("still refuses a screen leaving when nobody is signed in", async () => {
    const { t, groupId } = await setupGroup();
    await expect(t.mutation(api.presence.leave, { groupId, screenId: "s1" })).rejects.toThrow("Sign in first");
  });

  it("keeps one row per open screen, so one device leaving does not hide another", async () => {
    const { admin, member, groupId } = await setupGroup();
    await member.client.mutation(api.presence.heartbeat, { groupId, screenId: "phone", onPlay: true });
    await member.client.mutation(api.presence.heartbeat, { groupId, screenId: "laptop", onPlay: false });
    await member.client.mutation(api.presence.leave, { groupId, screenId: "laptop" });
    expect(await admin.client.query(api.presence.list, { groupId })).toEqual([expect.objectContaining({ userId: member.userId, onPlay: true })]);
  });

  it("forgets screens that closed without saying so", async () => {
    const { admin, member, groupId } = await setupGroup();
    await member.client.mutation(api.presence.heartbeat, { groupId, screenId: "old", onPlay: true });
    vi.setSystemTime(NOW + 11 * 60_000);
    await member.client.mutation(api.presence.heartbeat, { groupId, screenId: "new", onPlay: false });
    expect(await admin.client.query(api.presence.list, { groupId })).toEqual([expect.objectContaining({ userId: member.userId, onPlay: false })]);
  });

  it("shows each screen's ping to Admins only", async () => {
    const { admin, member, groupId } = await setupGroup();
    await member.client.mutation(api.presence.heartbeat, { groupId, screenId: "phone", onPlay: true, roundTripMs: 42.6 });
    await admin.client.mutation(api.presence.heartbeat, { groupId, screenId: "laptop", onPlay: true, roundTripMs: 18 });
    expect(await admin.client.query(api.presence.list, { groupId })).toEqual(
      expect.arrayContaining([expect.objectContaining({ userId: member.userId, roundTripMs: 43 })]),
    );
    expect((await member.client.query(api.presence.list, { groupId })).map((row) => row.roundTripMs)).toEqual([null, null]);
  });

  it("removes guests who have been away for an hour, but not signed-in Members or guests still around", async () => {
    const { t, admin, member, groupId } = await setupGroup();
    const signedIn = await t.run((ctx) => ctx.db.insert("users", { email: "joanne@example.com" }));
    const returning = await t.run((ctx) => ctx.db.insert("users", { isAnonymous: true }));
    const signedInClient = t.withIdentity({ subject: `${signedIn}|session` });
    const returningClient = t.withIdentity({ subject: `${returning}|session` });
    const { joinCode } = (await t.run((ctx) => ctx.db.get(groupId)))!;
    await signedInClient.mutation(api.groups.joinGroup, { joinCode, displayName: "Joanne" });
    await returningClient.mutation(api.groups.joinGroup, { joinCode, displayName: "Minwoo" });
    await member.client.mutation(api.presence.heartbeat, { groupId, screenId: "phone", onPlay: true });
    await member.client.mutation(api.presence.leave, { groupId, screenId: "phone" });

    vi.setSystemTime(NOW + 50 * 60_000);
    await returningClient.mutation(api.presence.heartbeat, { groupId, screenId: "tablet", onPlay: false });
    vi.setSystemTime(NOW + 61 * 60_000);
    await t.mutation(internal.presence.removeAbsentGuests, {});

    const names = (await admin.client.query(api.groups.members, { groupId })).map((m) => m.displayName);
    expect(names).toEqual(["Admin", "Joanne", "Minwoo"]);
    await expect(member.client.query(api.groups.members, { groupId })).rejects.toThrow(/Sign in first/);
    expect(await t.run((ctx) => ctx.db.get(member.userId))).toBeNull();
  });

  it("forgets a guest's account and empty Offline space with their last membership, but keeps a guest who has Songs in Offline", async () => {
    const { t, member, groupId } = await setupGroup();
    const offlineId = await member.client.mutation(api.groups.openOffline, {});
    const keeper = await t.run((ctx) => ctx.db.insert("users", { isAnonymous: true }));
    const keeperClient = t.withIdentity({ subject: `${keeper}|session` });
    const { joinCode } = (await t.run((ctx) => ctx.db.get(groupId)))!;
    await keeperClient.mutation(api.groups.joinGroup, { joinCode, displayName: "Keeper" });
    const keeperOffline = await keeperClient.mutation(api.groups.openOffline, {});
    await keeperClient.mutation(api.songs.createSong, { groupId: keeperOffline, title: "Mine" });
    await t.run((ctx) => ctx.db.insert("authSessions", { userId: member.userId, expirationTime: NOW + 10 * 60_000 }));

    vi.setSystemTime(NOW + 61 * 60_000);
    await t.mutation(internal.presence.removeAbsentGuests, {});

    expect(await t.run((ctx) => ctx.db.get(member.userId))).toBeNull();
    expect(await t.run((ctx) => ctx.db.get(offlineId))).toBeNull();
    expect(await t.run((ctx) => ctx.db.query("authSessions").collect())).toEqual([]);
    expect(await t.run((ctx) => ctx.db.get(keeper))).not.toBeNull();
    expect(await t.run((ctx) => ctx.db.get(keeperOffline))).not.toBeNull();
    expect((await keeperClient.query(api.groups.myGroups, {})).map((g) => g.name)).toEqual(["Offline"]);
  });

  it("forgets guests who never joined a Group after an hour, unless their Offline has Songs", async () => {
    const { t } = await setupGroup();
    const idle = await t.run((ctx) => ctx.db.insert("users", { isAnonymous: true }));
    const practising = await t.run((ctx) => ctx.db.insert("users", { isAnonymous: true }));
    const practisingClient = t.withIdentity({ subject: `${practising}|session` });
    const offlineId = await practisingClient.mutation(api.groups.openOffline, {});
    await practisingClient.mutation(api.songs.createSong, { groupId: offlineId, title: "Etude" });
    const fresh = await t.run((ctx) => ctx.db.insert("users", { isAnonymous: true }));
    await t.run((ctx) => ctx.db.patch(fresh, { name: "fresh" }));

    vi.setSystemTime(NOW + 61 * 60_000);
    const late = await t.run((ctx) => ctx.db.insert("users", { isAnonymous: true }));
    await t.mutation(internal.presence.forgetGuestsWhoNeverJoined, {});

    expect(await t.run((ctx) => ctx.db.get(idle))).toBeNull();
    expect(await t.run((ctx) => ctx.db.get(fresh))).toBeNull();
    expect(await t.run((ctx) => ctx.db.get(late))).not.toBeNull();
    expect(await t.run((ctx) => ctx.db.get(practising))).not.toBeNull();
    expect(await t.run((ctx) => ctx.db.get(offlineId))).not.toBeNull();
  });

  it("takes no heartbeats for Offline, which plays on the device clock", async () => {
    const { member } = await setupGroup();
    const offlineId = await member.client.mutation(api.groups.openOffline, {});
    await expect(member.client.mutation(api.presence.heartbeat, { groupId: offlineId, screenId: "s1", onPlay: true })).rejects.toThrow(/Offline plays on this device only/);
  });

  it("is only visible to and written by people in the Group", async () => {
    const { outsider, groupId } = await setupGroup();
    await expect(outsider.client.mutation(api.presence.heartbeat, { groupId, screenId: "s1", onPlay: true })).rejects.toThrow(/not in this Group/);
    await expect(outsider.client.query(api.presence.list, { groupId })).rejects.toThrow(/not in this Group/);
  });
});
describe("Who is around in each of my Groups", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => vi.useRealTimers());

  it("gives each Member's latest heartbeat once per Group, only for my Groups", async () => {
    const { admin, member, outsider, groupId } = await setupGroup();
    await member.client.mutation(api.presence.heartbeat, { groupId, screenId: "phone", onPlay: true });
    vi.setSystemTime(NOW + 1_000);
    await member.client.mutation(api.presence.heartbeat, { groupId, screenId: "laptop", onPlay: false });
    await admin.client.mutation(api.presence.heartbeat, { groupId, screenId: "admin", onPlay: true });

    const seen = await member.client.query(api.presence.myGroupsSeen, {});
    expect(seen).toEqual({ serverNow: expect.any(Number), groups: [{ groupId, seenAt: [NOW + 1_000, NOW + 1_000] }] });
    expect((await outsider.client.query(api.presence.myGroupsSeen, {})).groups).toEqual([]);
  });

  it("forgets screens that stopped sending heartbeats, whatever the Member's role", async () => {
    const { t, admin, member, groupId } = await setupGroup();
    await admin.client.mutation(api.presence.heartbeat, { groupId, screenId: "old-admin", onPlay: false });
    await member.client.mutation(api.presence.heartbeat, { groupId, screenId: "old-member", onPlay: false });
    const adminSeenAt = await t.run(async (ctx) => {
      const row = await ctx.db
        .query("presence")
        .withIndex("by_group_user", (q) => q.eq("groupId", groupId).eq("userId", admin.userId))
        .unique();
      const membership = await ctx.db
        .query("memberships")
        .withIndex("by_group_user", (q) => q.eq("groupId", groupId).eq("userId", admin.userId))
        .unique();
      await ctx.db.patch(membership!._id, { lastSeenAt: NOW - 30 * 60_000 });
      return row!.seenAt;
    });
    vi.setSystemTime(NOW + 11 * 60_000);
    await member.client.mutation(api.presence.heartbeat, { groupId, screenId: "new", onPlay: true });
    await t.mutation(internal.presence.forgetOldScreens, {});
    const left = await t.run((ctx) => ctx.db.query("presence").collect());
    expect(left.map((row) => row.screenId)).toEqual(["new"]);
    const adminMembership = await t.run((ctx) =>
      ctx.db
        .query("memberships")
        .withIndex("by_group_user", (q) => q.eq("groupId", groupId).eq("userId", admin.userId))
        .unique(),
    );
    expect(adminMembership?.lastSeenAt).toBe(adminSeenAt);
    expect((await member.client.query(api.presence.myGroupsSeen, {})).groups[0].seenAt).toEqual([NOW + 11 * 60_000]);
  });
});
