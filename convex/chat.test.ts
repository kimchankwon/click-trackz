/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { api, internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const NOW = 1_000_000;
const PAGE = { numItems: 20, cursor: null };
const toSecond = (at: number) => Math.round(at / 1_000) * 1_000;

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
  const { groupId, joinCode } = await admin.client.mutation(api.groups.createGroup, { name: "Band", displayName: "Admin" });
  const member = await as({ isAnonymous: true });
  await member.client.mutation(api.groups.joinGroup, { joinCode, displayName: "Jisue" });
  const outsider = await as({ isAnonymous: true });
  return { t, admin, member, outsider, groupId };
}

describe("Comments and Reactions", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => vi.useRealTimers());

  it("lets any Member comment, shows the history newest first and logs it in Activity", async () => {
    const { admin, member, groupId } = await setupGroup();
    await member.client.mutation(api.chat.comment, { groupId, text: "  Ready  when\nyou are " });
    vi.setSystemTime(NOW + 2_000);
    await admin.client.mutation(api.chat.comment, { groupId, text: "Counting in" });
    const { page } = await member.client.query(api.chat.comments, { groupId, paginationOpts: PAGE });
    expect(page.map(({ name, text, at }) => ({ name, text, at: toSecond(at) }))).toEqual([
      { name: "Admin", text: "Counting in", at: NOW + 2_000 },
      { name: "Jisue", text: "Ready when you are", at: NOW },
    ]);
    const activity = await admin.client.query(api.activity.list, { groupId, kind: "comment", paginationOpts: PAGE });
    expect(activity.page.map((row) => `${row.actorName}: ${row.summary}`)).toEqual(['Admin: Said "Counting in"', 'Jisue: Said "Ready when you are"']);
  });

  it("refuses empty, overlong and rapid-fire Comments", async () => {
    const { member, groupId } = await setupGroup();
    await expect(member.client.mutation(api.chat.comment, { groupId, text: "   " })).rejects.toThrow(/Write something/);
    await expect(member.client.mutation(api.chat.comment, { groupId, text: "x".repeat(201) })).rejects.toThrow(/up to 200/);
    await member.client.mutation(api.chat.comment, { groupId, text: "one" });
    await expect(member.client.mutation(api.chat.comment, { groupId, text: "two" })).rejects.toThrow(/Slow down/);
    vi.setSystemTime(NOW + 1_100);
    await member.client.mutation(api.chat.comment, { groupId, text: "two" });
  });

  it("sends only the offered Reactions and keeps them out of Activity", async () => {
    const { admin, member, groupId } = await setupGroup();
    await member.client.mutation(api.chat.react, { groupId, reaction: "🔥" });
    await expect(member.client.mutation(api.chat.react, { groupId, reaction: "🔥" })).rejects.toThrow(/Slow down/);
    await expect(member.client.mutation(api.chat.react, { groupId, reaction: "hello" })).rejects.toThrow(/not offered/);
    expect((await admin.client.query(api.chat.reactions, { groupId })).map(({ name, text, at }) => ({ name, text, at: toSecond(at) }))).toEqual([{ name: "Jisue", text: "🔥", at: NOW }]);
    expect((await admin.client.query(api.activity.list, { groupId, paginationOpts: PAGE })).page.every((row) => row.kind !== "comment")).toBe(true);
  });

  it("returns every Reaction that can still float, however many, and none that have finished", async () => {
    const { admin, member, groupId } = await setupGroup();
    await member.client.mutation(api.chat.react, { groupId, reaction: "👍" });
    vi.setSystemTime(NOW + 7_000);
    expect(await admin.client.query(api.chat.reactions, { groupId })).toEqual([]);
    for (let i = 0; i < 24; i++) {
      vi.setSystemTime(NOW + 8_000 + i * 130);
      await (i % 2 === 0 ? admin : member).client.mutation(api.chat.react, { groupId, reaction: "🔥" });
    }
    expect(await admin.client.query(api.chat.reactions, { groupId })).toHaveLength(24);
  });

  it("keeps people outside the Group and My Library out of it", async () => {
    const { admin, outsider, groupId } = await setupGroup();
    await expect(outsider.client.mutation(api.chat.comment, { groupId, text: "hi" })).rejects.toThrow(/not in this Group/);
    await expect(outsider.client.query(api.chat.reactions, { groupId })).rejects.toThrow(/not in this Group/);
    const libraryId = await admin.client.mutation(api.groups.openOffline, {});
    await expect(admin.client.mutation(api.chat.comment, { groupId: libraryId, text: "hi" })).rejects.toThrow(/not My Library/);
  });

  it("forgets Reactions after ten minutes but keeps Comments", async () => {
    const { t, admin, member, groupId } = await setupGroup();
    await member.client.mutation(api.chat.react, { groupId, reaction: "👏" });
    await member.client.mutation(api.chat.comment, { groupId, text: "kept" });
    vi.setSystemTime(NOW + 11 * 60_000);
    await t.mutation(internal.chat.forgetOldReactions, {});
    expect(await t.run((ctx) => ctx.db.query("chat").collect())).toMatchObject([{ kind: "comment", text: "kept" }]);
    expect((await admin.client.query(api.chat.comments, { groupId, paginationOpts: PAGE })).page).toHaveLength(1);
  });

  it("forgets every Comment and Reaction when the Group is deleted", async () => {
    const { t, admin, member, groupId } = await setupGroup();
    await member.client.mutation(api.chat.comment, { groupId, text: "bye" });
    await member.client.mutation(api.chat.react, { groupId, reaction: "🙌" });
    await admin.client.mutation(api.groups.deleteGroup, { groupId });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(await t.run((ctx) => ctx.db.query("chat").collect())).toEqual([]);
  });
});
