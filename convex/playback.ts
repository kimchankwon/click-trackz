import { ConvexError, v } from "convex/values";

import { demoSong } from "../src/sync/demo-song";
import { commandBoundary } from "../src/sync/timeline";
import type { Id } from "./_generated/dataModel";
import { mutation, query, type QueryCtx } from "./_generated/server";
import { requireAdmin, requireMember } from "./access";

const LEAD_IN_MS = 2_000;
const MIN_COMMAND_LEAD_MS = 1_000;

async function groupPlayback(ctx: QueryCtx, groupId: Id<"groups">) {
  return ctx.db
    .query("playbacks")
    .withIndex("by_group", (q) => q.eq("groupId", groupId))
    .unique();
}

export const current = query({
  args: { groupId: v.id("groups") },
  handler: async (ctx, { groupId }) => {
    await requireMember(ctx, groupId);
    const playback = await groupPlayback(ctx, groupId);
    if (playback === null) return null;
    const { startsAt, startSection, jumps, stopsAt } = playback;
    return { startsAt, startSection, jumps, stopsAt };
  },
});

export const start = mutation({
  args: { groupId: v.id("groups") },
  handler: async (ctx, { groupId }) => {
    const { user } = await requireAdmin(ctx, groupId);
    const fields = {
      groupId,
      startsAt: Date.now() + LEAD_IN_MS,
      startSection: 0,
      jumps: [],
      stopsAt: null,
      startedBy: user._id,
    };
    const existing = await groupPlayback(ctx, groupId);
    if (existing) await ctx.db.replace(existing._id, fields);
    else await ctx.db.insert("playbacks", fields);
  },
});

export const jump = mutation({
  args: {
    groupId: v.id("groups"),
    toSection: v.number(),
    mode: v.union(v.literal("nextBar"), v.literal("endOfSection")),
  },
  handler: async (ctx, { groupId, toSection, mode }) => {
    await requireAdmin(ctx, groupId);
    if (!Number.isInteger(toSection) || toSection < 0 || toSection >= demoSong.sections.length) {
      throw new ConvexError("That Section is not in the Song");
    }
    const playback = await groupPlayback(ctx, groupId);
    if (playback === null) throw new ConvexError("Nothing is playing");
    const at = commandBoundary(demoSong, playback, {
      nowMs: Date.now(),
      minLeadMs: MIN_COMMAND_LEAD_MS,
      mode,
    });
    if (at === null) throw new ConvexError("Playback has already ended");
    const jumps = [...playback.jumps.filter((j) => j.at < at), { at, toSection }];
    await ctx.db.patch(playback._id, { jumps });
  },
});

export const stop = mutation({
  args: { groupId: v.id("groups") },
  handler: async (ctx, { groupId }) => {
    await requireAdmin(ctx, groupId);
    const playback = await groupPlayback(ctx, groupId);
    if (playback === null) throw new ConvexError("Nothing is playing");
    const stopsAt = commandBoundary(demoSong, playback, {
      nowMs: Date.now(),
      minLeadMs: MIN_COMMAND_LEAD_MS,
      mode: "nextBar",
    });
    if (stopsAt === null) throw new ConvexError("Playback has already ended");
    await ctx.db.patch(playback._id, { stopsAt });
  },
});
