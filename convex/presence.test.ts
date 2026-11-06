/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { api } from "./_generated/api";
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
  return { admin, member, outsider, groupId };
}

describe("Presence", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => vi.useRealTimers());

  it("records each Member's latest heartbeat and whether they are on Play", async () => {
    const { admin, member, groupId } = await setupGroup();
    await member.client.mutation(api.presence.heartbeat, { groupId, onPlay: false });
    vi.setSystemTime(NOW + 5_000);
    await member.client.mutation(api.presence.heartbeat, { groupId, onPlay: true });
    expect(await admin.client.query(api.presence.list, { groupId })).toEqual([{ userId: member.userId, onPlay: true, seenAt: NOW + 5_000 }]);
  });

  it("forgets a Member who leaves the screen or the Group", async () => {
    const { admin, member, groupId } = await setupGroup();
    await admin.client.mutation(api.presence.heartbeat, { groupId, onPlay: true });
    await member.client.mutation(api.presence.heartbeat, { groupId, onPlay: true });
    await admin.client.mutation(api.presence.leave, { groupId });
    await member.client.mutation(api.groups.leaveGroup, { groupId });
    await admin.client.mutation(api.presence.heartbeat, { groupId, onPlay: false });
    expect(await admin.client.query(api.presence.list, { groupId })).toEqual([expect.objectContaining({ userId: admin.userId, onPlay: false })]);
  });

  it("is only visible to and written by people in the Group", async () => {
    const { outsider, groupId } = await setupGroup();
    await expect(outsider.client.mutation(api.presence.heartbeat, { groupId, onPlay: true })).rejects.toThrow(/not in this Group/);
    await expect(outsider.client.query(api.presence.list, { groupId })).rejects.toThrow(/not in this Group/);
  });
});
