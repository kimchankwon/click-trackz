import { ConvexError, v } from "convex/values";

import { nextInSetlist, setlistPosition } from "../src/lib/setlist-next";
import { endVampJumps, jumpProblem, jumpsAfter, leadInMs, MIN_COMMAND_LEAD_MS, repeatJumps, startedPlayback, startProblem, stopTime, type CommandResult } from "../src/sync/commands";
import { ONLINE_WITHIN_MS } from "../src/presence/online";
import { playbackEndsAt } from "../src/sync/timeline";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
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
    const { songId, song, startsAt, startSection, startBar, jumps, stopsAt, startedBy, stoppedBy, advance, setlistIndex } = playback;
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
      advance: advance === true,
      setlistIndex: setlistIndex ?? null,
    };
  },
});

async function cancelAdvance(ctx: MutationCtx, playback: Doc<"playbacks">) {
  if (playback.advanceJob === undefined) return;
  const job = await ctx.db.system.get(playback.advanceJob);
  if (job?.state.kind === "pending") await ctx.scheduler.cancel(playback.advanceJob);
}

async function planAdvance(ctx: MutationCtx, playbackId: Id<"playbacks">) {
  const playback = await ctx.db.get(playbackId);
  if (playback === null) return;
  await cancelAdvance(ctx, playback);
  const endsAt = playback.song.sections.length > 0 ? playbackEndsAt(playback.song, playback) : -Infinity;
  const due = playback.advance === true && playback.stopsAt === null && Number.isFinite(endsAt);
  const advanceJob = due ? await ctx.scheduler.runAt(endsAt, internal.playback.advance, { groupId: playback.groupId, startsAt: playback.startsAt }) : undefined;
  await ctx.db.patch(playbackId, { advanceJob });
}

export const start = mutation({
  args: {
    groupId: v.id("groups"),
    songId: v.id("songs"),
    fromSection: v.optional(v.number()),
    fromBar: v.optional(v.number()),
    advance: v.optional(v.boolean()),
    setlistIndex: v.optional(v.number()),
  },
  handler: async (ctx, { groupId, songId, fromSection, fromBar, advance, setlistIndex }) => {
    const { user } = await requireAdmin(ctx, groupId);
    const group = await ctx.db.get(groupId);
    if (group?.offline === true) throw new ConvexError("Offline plays on this device only");
    const song = await ctx.db.get(songId);
    if (song === null || song.groupId !== groupId) throw new ConvexError("That Song is not in this Group");
    const problem = startProblem(song, { fromSection, fromBar });
    if (problem !== null) throw new ConvexError(problem);
    const now = Date.now();
    const presence = await ctx.db
      .query("presence")
      .withIndex("by_group", (q) => q.eq("groupId", groupId))
      .collect();
    const roundTrips = presence.filter((row) => now - row.seenAt <= ONLINE_WITHIN_MS).map((row) => row.roundTripMs);
    const fields = {
      groupId,
      songId,
      startedBy: user._id,
      ...(advance === true ? { advance } : {}),
      ...(setlistIndex !== undefined && Number.isInteger(setlistIndex) && setlistIndex >= 0 ? { setlistIndex } : {}),
      ...startedPlayback(song, { fromSection, fromBar }, now, now + leadInMs(roundTrips)),
    };
    const existing = await groupPlayback(ctx, groupId);
    if (existing) await cancelAdvance(ctx, existing);
    const playbackId = existing ? existing._id : await ctx.db.insert("playbacks", fields);
    if (existing) await ctx.db.replace(existing._id, fields);
    await planAdvance(ctx, playbackId);
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
    await planAdvance(ctx, playback._id);
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
  await planAdvance(ctx, playback._id);
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

export const setAdvance = mutation({
  args: { groupId: v.id("groups"), startsAt: v.optional(v.number()), advance: v.boolean() },
  handler: async (ctx, { groupId, startsAt, advance }) => {
    await requireAdmin(ctx, groupId);
    const playback = await groupPlayback(ctx, groupId);
    if (playback === null || !samePlayback(playback, startsAt)) return;
    await ctx.db.patch(playback._id, { advance: advance ? true : undefined });
    await planAdvance(ctx, playback._id);
  },
});

export const advance = internalMutation({
  args: { groupId: v.id("groups"), startsAt: v.number() },
  handler: async (ctx, { groupId, startsAt }) => {
    const playback = await groupPlayback(ctx, groupId);
    if (playback === null || playback.startsAt !== startsAt || playback.stopsAt !== null || playback.advance !== true) return;
    const group = await ctx.db.get(groupId);
    const setlist = group?.currentSetlistId ? await ctx.db.get(group.currentSetlistId) : null;
    const order = setlist?.entries.map((entry) => entry.songId) ?? [];
    const songs = new Map((await Promise.all(order.map((id) => ctx.db.get(id)))).flatMap((song) => (song ? [[song._id, song] as const] : [])));
    const position = setlistPosition(order, playback.songId, playback.setlistIndex);
    const nextUp = position === null ? null : nextInSetlist(order, position, (id) => (songs.get(id)?.sections.length ?? 0) > 0 && songs.get(id)?.groupId === groupId);
    const next = nextUp === null ? undefined : songs.get(nextUp.item);
    if (next === undefined || nextUp === null) {
      await ctx.db.patch(playback._id, { advanceJob: undefined });
      return;
    }
    const now = Date.now();
    await ctx.db.replace(playback._id, {
      groupId,
      songId: next._id,
      startedBy: playback.startedBy,
      advance: true,
      setlistIndex: nextUp.index,
      ...startedPlayback(next, {}, now, now + MIN_COMMAND_LEAD_MS),
    });
    await planAdvance(ctx, playback._id);
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
    await planAdvance(ctx, playback._id);
  },
});
