import { v } from "convex/values";

import type { Id } from "./_generated/dataModel";
import { mutation, query, type MutationCtx } from "./_generated/server";
import { requireMember } from "./access";

async function ownPresence(ctx: MutationCtx, groupId: Id<"groups">, userId: Id<"users">) {
  return ctx.db
    .query("presence")
    .withIndex("by_group_user", (q) => q.eq("groupId", groupId).eq("userId", userId))
    .unique();
}

export const heartbeat = mutation({
  args: { groupId: v.id("groups"), onPlay: v.boolean() },
  handler: async (ctx, { groupId, onPlay }) => {
    const { user } = await requireMember(ctx, groupId);
    const existing = await ownPresence(ctx, groupId, user._id);
    const seenAt = Date.now();
    if (existing) await ctx.db.patch(existing._id, { onPlay, seenAt });
    else await ctx.db.insert("presence", { groupId, userId: user._id, onPlay, seenAt });
  },
});

export const leave = mutation({
  args: { groupId: v.id("groups") },
  handler: async (ctx, { groupId }) => {
    const { user } = await requireMember(ctx, groupId);
    const existing = await ownPresence(ctx, groupId, user._id);
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
