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
    await expect(member.client.query(api.groups.members, { groupId })).rejects.toThrow(/not in this Group/);
  });

  it("is only visible to and written by people in the Group", async () => {
    const { outsider, groupId } = await setupGroup();
    await expect(outsider.client.mutation(api.presence.heartbeat, { groupId, screenId: "s1", onPlay: true })).rejects.toThrow(/not in this Group/);
    await expect(outsider.client.query(api.presence.list, { groupId })).rejects.toThrow(/not in this Group/);
  });
});
