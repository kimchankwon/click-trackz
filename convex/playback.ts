import { ConvexError, v } from "convex/values";

import { endVampJumps, jumpProblem, jumpsAfter, LEAD_IN_MS, repeatJumps, startedPlayback, startProblem, stopTime, type CommandResult } from "../src/sync/commands";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { requireMember, requireRole, requireRoleInUnlocked } from "./access";
import { logActivity } from "./activity";
import { sectionName } from "../src/activity/changes";
import type { Jump } from "../src/sync/timeline";

async function displayNameIn(ctx: QueryCtx, groupId: Id<"groups">, userId: Id<"users"> | undefined) {
  if (userId === undefined) return null;
  const membership = await ctx.db
    .query("memberships")
    .withIndex("by_group_user", (q) => q.eq("groupId", groupId).eq("userId", userId))
    .unique();
  return membership?.displayName ?? null;
}

async function songTitleOf(ctx: QueryCtx, playback: Doc<"playbacks">) {
  return (await ctx.db.get(playback.songId))?.title ?? "a Song";
}

const sectionOf = (playback: Doc<"playbacks">, index: number) => {
  const section = playback.song.sections[index];
  return section === undefined ? "the end" : sectionName(section);
};

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
    const { user, membership, group } = await requireRoleInUnlocked(ctx, groupId, "playbackManager");
    if (group.offline === true) throw new ConvexError("My Library plays on this device only");
    const song = await ctx.db.get(songId);
    if (song === null || song.groupId !== groupId) throw new ConvexError("That Song is not in this Group");
    const problem = startProblem(song, { fromSection, fromBar });
    if (problem !== null) throw new ConvexError(problem);
    const now = Date.now();
    const existing = await groupPlayback(ctx, groupId);
    const firstBeat = now + LEAD_IN_MS;
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
    const from = fromSection !== undefined && fromSection > 0 ? song.sections[fromSection] : undefined;
    const fromWhere = from === undefined ? "" : ` from ${sectionName(from)}`;
    const atBar = fromBar !== undefined && fromBar > 1 ? `${fromWhere === "" ? " from" : ","} bar ${fromBar}` : "";
    await logActivity(ctx, membership, "playback", `Started ${song.title}${fromWhere}${atBar}`);
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
    const { membership } = await requireRoleInUnlocked(ctx, groupId, "playbackManager");
    const playback = await groupPlayback(ctx, groupId);
    if (playback === null) throw new ConvexError("Nothing is playing");
    if (!samePlayback(playback, startsAt)) throw new ConvexError("That Playback has already ended");
    const problem = jumpProblem(playback.song, toSection);
    if (problem !== null) throw new ConvexError(problem);
    const jumps = jumpsAfter(playback.song, playback, toSection, mode, Date.now());
    if (jumps === null) throw new ConvexError("Playback has already ended");
    await ctx.db.patch(playback._id, { jumps });
    const when = mode === "endOfSection" ? "At the end of the Section" : "At the next bar";
    await logActivity(ctx, membership, "playback", `Jumped to ${sectionOf(playback, toSection)} in ${await songTitleOf(ctx, playback)}`, [when]);
  },
});

async function applyCommand(
  ctx: MutationCtx,
  groupId: Id<"groups">,
  startsAt: number | undefined,
  command: (playback: Doc<"playbacks">) => CommandResult,
  describe: (playback: Doc<"playbacks">, jumps: readonly Jump[]) => string,
) {
  const { membership } = await requireRoleInUnlocked(ctx, groupId, "playbackManager");
  const playback = await groupPlayback(ctx, groupId);
  if (playback === null) throw new ConvexError("Nothing is playing");
  if (!samePlayback(playback, startsAt)) throw new ConvexError("That Playback has already ended");
  const result = command(playback);
  if ("problem" in result) throw new ConvexError(result.problem);
  await ctx.db.patch(playback._id, { jumps: result.jumps });
  await logActivity(ctx, membership, "playback", `${describe(playback, result.jumps)} in ${await songTitleOf(ctx, playback)}`);
}

export const repeatSection = mutation({
  args: { groupId: v.id("groups"), startsAt: v.optional(v.number()), vamp: v.optional(v.boolean()) },
  handler: async (ctx, { groupId, startsAt, vamp }) =>
    applyCommand(
      ctx,
      groupId,
      startsAt,
      (playback) => repeatJumps(playback.song, playback, Date.now(), vamp === true),
      (playback, jumps) => `${vamp === true ? "Vamped on" : "Repeated"} ${sectionOf(playback, jumps.at(-1)?.toSection ?? 0)}`,
    ),
});

export const endVamp = mutation({
  args: { groupId: v.id("groups"), startsAt: v.optional(v.number()) },
  handler: async (ctx, { groupId, startsAt }) =>
    applyCommand(
      ctx,
      groupId,
      startsAt,
      (playback) => endVampJumps(playback.song, playback, Date.now()),
      (playback, jumps) => `Ended the vamp on ${sectionOf(playback, (jumps.at(-1)?.toSection ?? 1) - 1)}`,
    ),
});

export const stop = mutation({
  args: { groupId: v.id("groups"), startsAt: v.optional(v.number()) },
  handler: async (ctx, { groupId, startsAt }) => {
    const { user, membership } = await requireRole(ctx, groupId, "playbackManager");
    const playback = await groupPlayback(ctx, groupId);
    if (playback === null) throw new ConvexError("Nothing is playing");
    if (!samePlayback(playback, startsAt)) throw new ConvexError("That Playback has already ended");
    const stopsAt = stopTime(playback.song, playback, Date.now());
    if (stopsAt === null) throw new ConvexError("Playback has already ended");
    await ctx.db.patch(playback._id, { stopsAt, stoppedBy: user._id });
    await logActivity(ctx, membership, "playback", `Stopped ${await songTitleOf(ctx, playback)}`);
  },
});
