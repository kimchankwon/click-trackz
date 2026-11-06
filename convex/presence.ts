import { ConvexError, v } from "convex/values";

import type { Id } from "./_generated/dataModel";
import { mutation, query, type MutationCtx } from "./_generated/server";
import { requireMember } from "./access";

const FORGET_AFTER_MS = 10 * 60_000;

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
  args: { groupId: v.id("groups"), screenId: v.string(), onPlay: v.boolean() },
  handler: async (ctx, { groupId, screenId, onPlay }) => {
    checkScreenId(screenId);
    const { user } = await requireMember(ctx, groupId);
    const seenAt = Date.now();
    const mine = await ctx.db
      .query("presence")
      .withIndex("by_group_user", (q) => q.eq("groupId", groupId).eq("userId", user._id))
      .collect();
    await Promise.all(mine.filter((row) => seenAt - row.seenAt > FORGET_AFTER_MS).map((row) => ctx.db.delete(row._id)));
    const existing = mine.find((row) => row.screenId === screenId && seenAt - row.seenAt <= FORGET_AFTER_MS);
    if (existing) await ctx.db.patch(existing._id, { onPlay, seenAt });
    else await ctx.db.insert("presence", { groupId, userId: user._id, screenId, onPlay, seenAt });
  },
});

export const leave = mutation({
  args: { groupId: v.id("groups"), screenId: v.string() },
  handler: async (ctx, { groupId, screenId }) => {
    const { user } = await requireMember(ctx, groupId);
    const existing = await screenPresence(ctx, groupId, user._id, screenId);
    if (existing) await ctx.db.delete(existing._id);
  },
});

export const list = query({
  args: { groupId: v.id("groups") },
  handler: async (ctx, { groupId }) => {
    await requireMember(ctx, groupId);
    const rows = await ctx.db
      .query("presence")
      .withIndex("by_group", (q) => q.eq("groupId", groupId))
      .collect();
    return rows.map(({ userId, onPlay, seenAt }) => ({ userId, onPlay, seenAt }));
  },
});
