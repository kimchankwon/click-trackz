import { ConvexError, v } from "convex/values";

import { endVampJumps, jumpProblem, jumpsAfter, leadInMs, repeatJumps, startedPlayback, startProblem, stopTime, type CommandResult } from "../src/sync/commands";
import { ONLINE_WITHIN_MS } from "../src/presence/online";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
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
    const { songId, song, startsAt, startSection, startBar, jumps, stopsAt, startedBy, stoppedBy, setlistIndex } = playback;
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
      setlistIndex: setlistIndex ?? null,
    };
  },
});

export const start = mutation({
  args: {
    groupId: v.id("groups"),
    songId: v.id("songs"),
    fromSection: v.optional(v.number()),
    fromBar: v.optional(v.number()),
    advance: v.optional(v.boolean()),
    setlistIndex: v.optional(v.number()),
  },
  handler: async (ctx, { groupId, songId, fromSection, fromBar, setlistIndex }) => {
    const { user } = await requireAdmin(ctx, groupId);
    const group = await ctx.db.get(groupId);
    if (group?.offline === true) throw new ConvexError("Offline plays on this device only");
    const song = await ctx.db.get(songId);
    if (song === null || song.groupId !== groupId) throw new ConvexError("That Song is not in this Group");
    const problem = startProblem(song, { fromSection, fromBar });
    if (problem !== null) throw new ConvexError(problem);
    const now = Date.now();
    const online = await ctx.db
      .query("presence")
      .withIndex("by_group_seen", (q) => q.eq("groupId", groupId).gte("seenAt", now - ONLINE_WITHIN_MS))
      .collect();
    const roundTrips = online.map((row) => row.roundTripMs);
    const existing = await groupPlayback(ctx, groupId);
    const firstBeat = now + leadInMs(roundTrips);
    const startsAt = existing?.startsAt === firstBeat ? firstBeat + 1 : firstBeat;
    const fields = {
      groupId,
      songId,
      startedBy: user._id,
      ...(setlistIndex !== undefined && Number.isInteger(setlistIndex) && setlistIndex >= 0 ? { setlistIndex } : {}),
      ...startedPlayback(song, { fromSection, fromBar }, now, startsAt),
    };
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

async function applyCommand(ctx: MutationCtx, groupId: Id<"groups">, startsAt: number | undefined, command: (playback: Doc<"playbacks">) => CommandResult) {
  await requireAdmin(ctx, groupId);
  const playback = await groupPlayback(ctx, groupId);
  if (playback === null) throw new ConvexError("Nothing is playing");
  if (!samePlayback(playback, startsAt)) throw new ConvexError("That Playback has already ended");
  const result = command(playback);
  if ("problem" in result) throw new ConvexError(result.problem);
  await ctx.db.patch(playback._id, { jumps: result.jumps });
}

export const repeatSection = mutation({
  args: { groupId: v.id("groups"), startsAt: v.optional(v.number()), vamp: v.optional(v.boolean()) },
  handler: async (ctx, { groupId, startsAt, vamp }) =>
    applyCommand(ctx, groupId, startsAt, (playback) => repeatJumps(playback.song, playback, Date.now(), vamp === true)),
});

export const endVamp = mutation({
  args: { groupId: v.id("groups"), startsAt: v.optional(v.number()) },
  handler: async (ctx, { groupId, startsAt }) => applyCommand(ctx, groupId, startsAt, (playback) => endVampJumps(playback.song, playback, Date.now())),
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
