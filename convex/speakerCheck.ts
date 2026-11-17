import { ConvexError, v } from "convex/values";

import type { Id } from "./_generated/dataModel";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { refuseLatePress, requireMember, requireRole, requireRoleInUnlocked } from "./access";
import { displayNames, onlineDevice } from "./presence";
import { LEAD_IN_MS, STOP_LEAD_MS } from "../src/sync/commands";
import { isDeviceId } from "../src/lib/device-identity";
import { SPEAKER_CHECK_MS } from "../src/sync/speaker-check";
import { playbackEndsAt } from "../src/sync/timeline";

async function groupCheck(ctx: QueryCtx, groupId: Id<"groups">) {
  return ctx.db
    .query("speakerChecks")
    .withIndex("by_group", (q) => q.eq("groupId", groupId))
    .unique();
}

async function liveCheck(ctx: QueryCtx, groupId: Id<"groups">) {
  const check = await groupCheck(ctx, groupId);
  if (check === null || check.stopsAt <= Date.now()) throw new ConvexError("Start a Speaker check first");
  return check;
}

export const current = query({
  args: { groupId: v.id("groups") },
  handler: async (ctx, { groupId }) => {
    await requireMember(ctx, groupId);
    const check = await groupCheck(ctx, groupId);
    if (check === null) return null;
    const names = await displayNames(ctx, groupId);
    return {
      startsAt: check.startsAt,
      stopsAt: check.stopsAt,
      comparedWith: check.comparedWith,
      listenTo: check.listenTo,
      listenToName: check.listenToName ?? null,
      startedByName: names.get(check.startedBy) ?? "The Admin",
    };
  },
});

export const start = mutation({
  args: { groupId: v.id("groups"), deviceId: v.string(), pressedAt: v.optional(v.number()) },
  handler: async (ctx, { groupId, deviceId, pressedAt }) => {
    const { user, group } = await requireRoleInUnlocked(ctx, groupId, "songManager");
    refuseLatePress(pressedAt, "Play check");
    if (group.offline === true) throw new ConvexError("My Library plays on this device only");
    if (!isDeviceId(deviceId)) throw new ConvexError("That device id is not one this app makes");
    const now = Date.now();
    const playback = await ctx.db
      .query("playbacks")
      .withIndex("by_group", (q) => q.eq("groupId", groupId))
      .unique();
    if (playback !== null && playbackEndsAt(playback.song, playback) > now) throw new ConvexError("Stop the Playback before you start a Speaker check");
    const startsAt = now + LEAD_IN_MS;
    const fields = { groupId, startsAt, stopsAt: startsAt + SPEAKER_CHECK_MS, startedBy: user._id, comparedWith: deviceId, listenTo: null };
    const existing = await groupCheck(ctx, groupId);
    if (existing) await ctx.db.replace(existing._id, fields);
    else await ctx.db.insert("speakerChecks", fields);
  },
});

export const listen = mutation({
  args: { groupId: v.id("groups"), deviceId: v.union(v.string(), v.null()), fromDeviceId: v.string() },
  handler: async (ctx, { groupId, deviceId, fromDeviceId }) => {
    await requireRole(ctx, groupId, "songManager");
    if (!isDeviceId(fromDeviceId)) throw new ConvexError("That device id is not one this app makes");
    const check = await liveCheck(ctx, groupId);
    if (deviceId === null || deviceId === fromDeviceId) {
      await ctx.db.patch(check._id, { listenTo: null, listenToName: undefined, comparedWith: fromDeviceId });
      return;
    }
    const [screen] = await onlineDevice(ctx, groupId, deviceId);
    const name = (await displayNames(ctx, groupId)).get(screen.userId) ?? "Member";
    await ctx.db.patch(check._id, { listenTo: deviceId, listenToName: `${name} (${screen.deviceLabel ?? "Device"})`, comparedWith: fromDeviceId });
  },
});

export const stop = mutation({
  args: { groupId: v.id("groups") },
  handler: async (ctx, { groupId }) => {
    await requireRole(ctx, groupId, "songManager");
    const check = await groupCheck(ctx, groupId);
    if (check === null) return;
    const stopsAt = Math.min(check.stopsAt, Date.now() + STOP_LEAD_MS);
    if (stopsAt !== check.stopsAt) await ctx.db.patch(check._id, { stopsAt });
  },
});

export async function endSpeakerCheck(ctx: MutationCtx, groupId: Id<"groups">) {
  const check = await groupCheck(ctx, groupId);
  if (check !== null) await ctx.db.delete(check._id);
}
