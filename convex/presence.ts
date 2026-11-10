import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";

import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { internalMutation, mutation, query, type MutationCtx } from "./_generated/server";
import { isGuest, membershipOf, requireMember, requireUser } from "./access";
import { forgetGuestIfGone } from "./cleanup";

const FORGET_AFTER_MS = 10 * 60_000;
const FORGET_BATCH = 500;
const MAX_ROUND_TRIP_MS = 60_000;
const LAST_SEEN_EVERY_MS = 20 * 60_000;
export const GUEST_ABSENCE_MS = 60 * 60_000;

const checkScreenId = (screenId: string) => {
  if (screenId.length === 0 || screenId.length > 64) throw new ConvexError("Screen id must be 1 to 64 characters");
};

async function screenPresence(ctx: MutationCtx, groupId: Id<"groups">, userId: Id<"users">, screenId: string) {
  return ctx.db
    .query("presence")
    .withIndex("by_group_user_screen", (q) => q.eq("groupId", groupId).eq("userId", userId).eq("screenId", screenId))
    .unique();
}

export const heartbeat = mutation({
  args: { groupId: v.id("groups"), screenId: v.string(), onPlay: v.boolean(), roundTripMs: v.optional(v.number()) },
  handler: async (ctx, { groupId, screenId, onPlay, roundTripMs }) => {
    checkScreenId(screenId);
    const ping = roundTripMs !== undefined && Number.isFinite(roundTripMs) ? Math.min(MAX_ROUND_TRIP_MS, Math.max(0, Math.round(roundTripMs))) : undefined;
    const { user, membership } = await requireMember(ctx, groupId);
    const group = await ctx.db.get(groupId);
    if (group?.offline === true) throw new ConvexError("Offline plays on this device only");
    const seenAt = Date.now();
    if ((membership.lastSeenAt ?? 0) < seenAt - LAST_SEEN_EVERY_MS) await ctx.db.patch(membership._id, { lastSeenAt: seenAt });
    const mine = await ctx.db
      .query("presence")
      .withIndex("by_group_user", (q) => q.eq("groupId", groupId).eq("userId", user._id))
      .collect();
    await Promise.all(mine.filter((row) => seenAt - row.seenAt > FORGET_AFTER_MS).map((row) => ctx.db.delete(row._id)));
    const existing = mine.find((row) => row.screenId === screenId && seenAt - row.seenAt <= FORGET_AFTER_MS);
    if (existing) await ctx.db.patch(existing._id, { onPlay, seenAt, roundTripMs: ping });
    else await ctx.db.insert("presence", { groupId, userId: user._id, screenId, onPlay, seenAt, roundTripMs: ping });
  },
});

export const leave = mutation({
  args: { groupId: v.id("groups"), screenId: v.string() },
  handler: async (ctx, { groupId, screenId }) => {
    const user = await requireUser(ctx);
    const membership = await membershipOf(ctx, groupId, user._id);
    if (membership === null) return;
    await ctx.db.patch(membership._id, { lastSeenAt: Date.now() });
    const existing = await screenPresence(ctx, groupId, user._id, screenId);
    if (existing) await ctx.db.delete(existing._id);
  },
});

export const list = query({
  args: { groupId: v.id("groups") },
  handler: async (ctx, { groupId }) => {
    const { membership } = await requireMember(ctx, groupId);
    const isAdmin = membership.role === "admin";
    const rows = await ctx.db
      .query("presence")
      .withIndex("by_group", (q) => q.eq("groupId", groupId))
      .collect();
    return rows.map(({ userId, onPlay, seenAt, roundTripMs }) => ({ userId, onPlay, seenAt, roundTripMs: isAdmin ? (roundTripMs ?? null) : null }));
  },
});

const SWEEP_PAGE = 100;

export const removeAbsentGuests = internalMutation({
  args: { cursor: v.optional(v.string()), cutoff: v.optional(v.number()), pageSize: v.optional(v.number()) },
  handler: async (ctx, { cursor, cutoff: sweepCutoff, pageSize }) => {
    const cutoff = sweepCutoff ?? Date.now() - GUEST_ABSENCE_MS;
    const { page, isDone, continueCursor } = await ctx.db
      .query("memberships")
      .withIndex("by_role_seen", (q) => q.eq("role", "member").lt("lastSeenAt", cutoff))
      .paginate({ cursor: cursor ?? null, numItems: pageSize ?? SWEEP_PAGE });
    for (const membership of page) {
      if (membership.lastSeenAt === undefined && membership._creationTime >= cutoff) continue;
      const user = await ctx.db.get(membership.userId);
      if (user !== null && !isGuest(user)) continue;
      const screens = await ctx.db
        .query("presence")
        .withIndex("by_group_user", (q) => q.eq("groupId", membership.groupId).eq("userId", membership.userId))
        .collect();
      if (screens.some((screen) => screen.seenAt >= cutoff)) continue;
      await Promise.all(screens.map((screen) => ctx.db.delete(screen._id)));
      await ctx.db.delete(membership._id);
      await forgetGuestIfGone(ctx, membership.userId);
    }
    if (!isDone) await ctx.scheduler.runAfter(0, internal.presence.removeAbsentGuests, { cursor: continueCursor, cutoff, pageSize });
  },
});


export const forgetGuestsWhoNeverJoined = internalMutation({
  args: { cursor: v.optional(v.string()), pageSize: v.optional(v.number()) },
  handler: async (ctx, { cursor, pageSize }) => {
    const cutoff = Date.now() - GUEST_ABSENCE_MS;
    const { page, isDone, continueCursor } = await ctx.db.query("users").paginate({ cursor: cursor ?? null, numItems: pageSize ?? SWEEP_PAGE });
    for (const user of page) {
      if (!isGuest(user) || user._creationTime >= cutoff) continue;
      const memberships = await ctx.db
        .query("memberships")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .collect();
      if (memberships.some((membership) => (membership.lastSeenAt ?? membership._creationTime) >= cutoff)) continue;
      await forgetGuestIfGone(ctx, user._id);
    }
    if (!isDone) await ctx.scheduler.runAfter(0, internal.presence.forgetGuestsWhoNeverJoined, { cursor: continueCursor, pageSize });
  },
});

export const myGroupsSeen = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return { serverNow: Date.now(), groups: [] };
    const memberships = await ctx.db
      .query("memberships")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const serverNow = Date.now();
    const groups = await Promise.all(
      memberships.map(async ({ groupId }) => {
        const rows = await ctx.db
          .query("presence")
          .withIndex("by_group_seen", (q) => q.eq("groupId", groupId).gt("seenAt", serverNow - FORGET_AFTER_MS))
          .collect();
        const latest = new Map<string, number>();
        for (const row of rows) latest.set(row.userId, Math.max(latest.get(row.userId) ?? 0, row.seenAt));
        return { groupId, seenAt: [...latest.values()] };
      }),
    );
    return { serverNow, groups };
  },
});

export const forgetOldScreens = internalMutation({
  args: {},
  handler: async (ctx) => {
    const old = await ctx.db
      .query("presence")
      .withIndex("by_seen", (q) => q.lt("seenAt", Date.now() - FORGET_AFTER_MS))
      .take(FORGET_BATCH);
    for (const row of old) {
      const membership = await membershipOf(ctx, row.groupId, row.userId);
      if (membership !== null && (membership.lastSeenAt ?? 0) < row.seenAt) await ctx.db.patch(membership._id, { lastSeenAt: row.seenAt });
      await ctx.db.delete(row._id);
    }
  },
});
