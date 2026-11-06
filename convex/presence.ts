import { ConvexError, v } from "convex/values";

import type { Id } from "./_generated/dataModel";
import { internalMutation, mutation, query, type MutationCtx } from "./_generated/server";
import { isGuest, membershipOf, requireMember, requireUser } from "./access";

const FORGET_AFTER_MS = 10 * 60_000;
const MAX_ROUND_TRIP_MS = 60_000;
const LAST_SEEN_EVERY_MS = 5 * 60_000;
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

export const removeAbsentGuests = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - GUEST_ABSENCE_MS;
    const memberships = await ctx.db.query("memberships").collect();
    for (const membership of memberships) {
      if (membership.role === "admin" || (membership.lastSeenAt ?? membership._creationTime) >= cutoff) continue;
      const user = await ctx.db.get(membership.userId);
      if (user !== null && !isGuest(user)) continue;
      const screens = await ctx.db
        .query("presence")
        .withIndex("by_group_user", (q) => q.eq("groupId", membership.groupId).eq("userId", membership.userId))
        .collect();
      if (screens.some((screen) => screen.seenAt >= cutoff)) continue;
      await Promise.all(screens.map((screen) => ctx.db.delete(screen._id)));
      await ctx.db.delete(membership._id);
    }
  },
});
