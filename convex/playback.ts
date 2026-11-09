import { ConvexError, v } from "convex/values";

import { jumpProblem, jumpsAfter, startedPlayback, startProblem, stopTime } from "../src/sync/commands";
import type { Id } from "./_generated/dataModel";
import { mutation, query, type QueryCtx } from "./_generated/server";
import { requireAdmin, requireMember } from "./access";

async function displayNameIn(ctx: QueryCtx, groupId: Id<"groups">, userId: Id<"users"> | undefined) {
  if (userId === undefined) return null;
  const membership = await ctx.db
    .query("memberships")
    .withIndex("by_group_user", (q) => q.eq("groupId", groupId).eq("userId", userId))
    .unique();
  return membership?.displayName ?? null;
}

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
    const { songId, song, startsAt, startSection, startBar, jumps, stopsAt, startedBy, stoppedBy } = playback;
    return {
      songId,
      song,
      startsAt,
      startSection,
      startBar: startBar ?? 1,
      jumps,
      stopsAt,
      startedBy,
      startedByName: await displayNameIn(ctx, groupId, startedBy),
      stoppedBy: stoppedBy ?? null,
      stoppedByName: await displayNameIn(ctx, groupId, stoppedBy),
    };
  },
});

export const start = mutation({
  args: { groupId: v.id("groups"), songId: v.id("songs"), fromSection: v.optional(v.number()), fromBar: v.optional(v.number()) },
  handler: async (ctx, { groupId, songId, fromSection, fromBar }) => {
    const { user } = await requireAdmin(ctx, groupId);
    const song = await ctx.db.get(songId);
    if (song === null || song.groupId !== groupId) throw new ConvexError("That Song is not in this Group");
    const problem = startProblem(song, { fromSection, fromBar });
    if (problem !== null) throw new ConvexError(problem);
    const fields = { groupId, songId, startedBy: user._id, ...startedPlayback(song, { fromSection, fromBar }, Date.now()) };
    const existing = await groupPlayback(ctx, groupId);
    if (existing) await ctx.db.replace(existing._id, fields);
    else await ctx.db.insert("playbacks", fields);
  },
});

const samePlayback = (playback: { startsAt: number }, startsAt: number | undefined) => startsAt === undefined || startsAt === playback.startsAt;

export const jump = mutation({
  args: {
    groupId: v.id("groups"),
    toSection: v.number(),
    mode: v.union(v.literal("nextBar"), v.literal("endOfSection")),
    startsAt: v.optional(v.number()),
  },
  handler: async (ctx, { groupId, toSection, mode, startsAt }) => {
    await requireAdmin(ctx, groupId);
    const playback = await groupPlayback(ctx, groupId);
    if (playback === null) throw new ConvexError("Nothing is playing");
    if (!samePlayback(playback, startsAt)) throw new ConvexError("That Playback has already ended");
    const problem = jumpProblem(playback.song, toSection);
    if (problem !== null) throw new ConvexError(problem);
    const jumps = jumpsAfter(playback.song, playback, toSection, mode, Date.now());
    if (jumps === null) throw new ConvexError("Playback has already ended");
    await ctx.db.patch(playback._id, { jumps });
  },
});

export const stop = mutation({
  args: { groupId: v.id("groups"), startsAt: v.optional(v.number()) },
  handler: async (ctx, { groupId, startsAt }) => {
    const { user } = await requireAdmin(ctx, groupId);
    const playback = await groupPlayback(ctx, groupId);
    if (playback === null) throw new ConvexError("Nothing is playing");
    if (!samePlayback(playback, startsAt)) throw new ConvexError("That Playback has already ended");
    const stopsAt = stopTime(playback.song, playback, Date.now());
    if (stopsAt === null) throw new ConvexError("Playback has already ended");
    await ctx.db.patch(playback._id, { stopsAt, stoppedBy: user._id });
  },
});
