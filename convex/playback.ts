import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";

import { demoSong } from "../src/sync/demo-song";
import { commandBoundary } from "../src/sync/timeline";

import { mutation, query, type QueryCtx } from "./_generated/server";

const DEMO_KEY = "demo";
const LEAD_IN_MS = 2_000;
const MIN_COMMAND_LEAD_MS = 1_000;

async function requireMember(ctx: QueryCtx) {
  const userId = await getAuthUserId(ctx);
  if (userId === null) throw new ConvexError("Sign in to control Playback");
  return userId;
}

async function demoPlayback(ctx: QueryCtx) {
  return ctx.db
    .query("playbacks")
    .withIndex("by_key", (q) => q.eq("key", DEMO_KEY))
    .unique();
}

export const current = query({
  args: {},
  handler: async (ctx) => {
    await requireMember(ctx);
    const playback = await demoPlayback(ctx);
    if (playback === null) return null;
    const { startsAt, startSection, jumps, stopsAt } = playback;
    return { startsAt, startSection, jumps, stopsAt };
  },
});

export const start = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireMember(ctx);
    const fields = {
      key: DEMO_KEY,
      startsAt: Date.now() + LEAD_IN_MS,
      startSection: 0,
      jumps: [],
      stopsAt: null,
      startedBy: userId,
    };
    const existing = await demoPlayback(ctx);
    if (existing) await ctx.db.replace(existing._id, fields);
    else await ctx.db.insert("playbacks", fields);
  },
});

export const jump = mutation({
  args: {
    toSection: v.number(),
    mode: v.union(v.literal("nextBar"), v.literal("endOfSection")),
  },
  handler: async (ctx, { toSection, mode }) => {
    await requireMember(ctx);
    if (!Number.isInteger(toSection) || toSection < 0 || toSection >= demoSong.sections.length) {
      throw new ConvexError("That Section is not in the Song");
    }
    const playback = await demoPlayback(ctx);
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
  args: {},
  handler: async (ctx) => {
    await requireMember(ctx);
    const playback = await demoPlayback(ctx);
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
