import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";

import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { isGuest, membershipOf, requireMember, requireRole, requireUser } from "./access";
import { forgetDevicesOf, forgetGuestIfGone } from "./cleanup";
import { joinRoleValidator } from "./schema";
import { isDeviceId, trimDeviceLabel } from "../src/lib/device-identity";
import { canEditSongs, canSteerPlayback, JOIN_ROLES } from "../src/lib/roles";
import { LATENCY_MAX_MS, LATENCY_MIN_MS } from "../src/settings/latency";

const FORGET_AFTER_MS = 10 * 60_000;
const FORGET_BATCH = 500;
const MAX_ROUND_TRIP_MS = 60_000;
const LAST_SEEN_EVERY_MS = 20 * 60_000;
export const GUEST_ABSENCE_MS = 60 * 60_000;
export const AWAY_DEVICES_SHOWN_MS = 30 * 24 * 60 * 60_000;
export const FORGET_DEVICES_AFTER_MS = 90 * 24 * 60 * 60_000;

const checkScreenId = (screenId: string) => {
  if (screenId.length === 0 || screenId.length > 64) throw new ConvexError("Screen id must be 1 to 64 characters");
};

const isNudge = (ms: number) => Number.isInteger(ms) && ms >= LATENCY_MIN_MS && ms <= LATENCY_MAX_MS;

type DeviceFields = { deviceId: string; deviceLabel: string; nudgeMs?: number };

function deviceFields(deviceId: string | undefined, deviceLabel: string | undefined, nudgeMs: number | undefined): DeviceFields | null {
  if (deviceId === undefined) return null;
  if (!isDeviceId(deviceId)) throw new ConvexError("That device id is not one this app makes");
  return {
    deviceId,
    deviceLabel: trimDeviceLabel(deviceLabel ?? "") || "Device",
    ...(nudgeMs !== undefined && isNudge(nudgeMs) ? { nudgeMs } : {}),
  };
}

async function rememberedDevice(ctx: QueryCtx, groupId: Id<"groups">, deviceId: string) {
  return ctx.db
    .query("groupDevices")
    .withIndex("by_group_device", (q) => q.eq("groupId", groupId).eq("deviceId", deviceId))
    .unique();
}

async function rememberDevice(ctx: MutationCtx, groupId: Id<"groups">, userId: Id<"users">, device: DeviceFields, seenAt: number) {
  const known = await rememberedDevice(ctx, groupId, device.deviceId);
  const fields = { userId, deviceLabel: device.deviceLabel, seenAt, ...(device.nudgeMs !== undefined ? { nudgeMs: device.nudgeMs } : {}) };
  if (known === null) {
    await ctx.db.insert("groupDevices", { groupId, deviceId: device.deviceId, ...fields });
    return null;
  }
  const heldTooLong = known.nudgeRequest !== undefined && seenAt - known.seenAt > AWAY_DEVICES_SHOWN_MS;
  const changed =
    heldTooLong ||
    known.userId !== userId ||
    known.deviceLabel !== device.deviceLabel ||
    (device.nudgeMs !== undefined && known.nudgeMs !== device.nudgeMs) ||
    seenAt - known.seenAt > LAST_SEEN_EVERY_MS;
  if (changed) await ctx.db.patch(known._id, { ...fields, ...(heldTooLong ? { nudgeRequest: undefined } : {}) });
  return heldTooLong ? null : known;
}

async function groupScreens(ctx: QueryCtx, groupId: Id<"groups">) {
  return ctx.db
    .query("presence")
    .withIndex("by_group", (q) => q.eq("groupId", groupId))
    .collect();
}

export async function displayNames(ctx: QueryCtx, groupId: Id<"groups">) {
  const memberships = await ctx.db
    .query("memberships")
    .withIndex("by_group", (q) => q.eq("groupId", groupId))
    .collect();
  return new Map<string, string>(memberships.map((membership) => [membership.userId, membership.displayName]));
}

export async function onlineDevice(ctx: QueryCtx, groupId: Id<"groups">, deviceId: string) {
  const now = Date.now();
  const rows = (await groupScreens(ctx, groupId)).filter((row) => row.deviceId === deviceId && now - row.seenAt <= FORGET_AFTER_MS);
  if (rows.length === 0) throw new ConvexError("That device has left the Group screen");
  return rows;
}

async function screenPresence(ctx: MutationCtx, groupId: Id<"groups">, userId: Id<"users">, screenId: string) {
  return ctx.db
    .query("presence")
    .withIndex("by_group_user_screen", (q) => q.eq("groupId", groupId).eq("userId", userId).eq("screenId", screenId))
    .unique();
}

export const heartbeat = mutation({
  args: {
    groupId: v.id("groups"),
    screenId: v.string(),
    onPlay: v.boolean(),
    roundTripMs: v.optional(v.number()),
    deviceId: v.optional(v.string()),
    deviceLabel: v.optional(v.string()),
    nudgeMs: v.optional(v.number()),
  },
  handler: async (ctx, { groupId, screenId, onPlay, roundTripMs, deviceId, deviceLabel, nudgeMs }) => {
    checkScreenId(screenId);
    const device = deviceFields(deviceId, deviceLabel, nudgeMs);
    const ping = roundTripMs !== undefined && Number.isFinite(roundTripMs) ? Math.min(MAX_ROUND_TRIP_MS, Math.max(0, Math.round(roundTripMs))) : undefined;
    const { user, membership } = await requireMember(ctx, groupId);
    const group = await ctx.db.get(groupId);
    if (group?.offline === true) throw new ConvexError("My Library plays on this device only");
    const seenAt = Date.now();
    if ((membership.lastSeenAt ?? 0) < seenAt - LAST_SEEN_EVERY_MS) await ctx.db.patch(membership._id, { lastSeenAt: seenAt });
    const mine = await ctx.db
      .query("presence")
      .withIndex("by_group_user", (q) => q.eq("groupId", groupId).eq("userId", user._id))
      .collect();
    await Promise.all(mine.filter((row) => seenAt - row.seenAt > FORGET_AFTER_MS).map((row) => ctx.db.delete(row._id)));
    const existing = mine.find((row) => row.screenId === screenId && seenAt - row.seenAt <= FORGET_AFTER_MS);
    const waiting = device === null ? undefined : (await rememberDevice(ctx, groupId, user._id, device, seenAt))?.nudgeRequest;
    const handOver = waiting !== undefined && existing?.nudgeRequest?.id !== waiting.id ? { nudgeRequest: waiting } : {};
    if (existing) await ctx.db.patch(existing._id, { onPlay, seenAt, roundTripMs: ping, ...device, ...handOver });
    else await ctx.db.insert("presence", { groupId, userId: user._id, screenId, onPlay, seenAt, roundTripMs: ping, ...device, ...handOver });
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

export const stillHere = mutation({
  args: { groupId: v.id("groups") },
  handler: async (ctx, { groupId }) => {
    const { membership } = await requireMember(ctx, groupId);
    await ctx.db.patch(membership._id, { lastSeenAt: Date.now() });
  },
});

export const list = query({
  args: { groupId: v.id("groups") },
  handler: async (ctx, { groupId }) => {
    const { membership } = await requireMember(ctx, groupId);
    const seesRoundTrips = canSteerPlayback(membership.role);
    const rows = await ctx.db
      .query("presence")
      .withIndex("by_group", (q) => q.eq("groupId", groupId))
      .collect();
    return rows.map(({ userId, onPlay, seenAt, roundTripMs }) => ({ userId, onPlay, seenAt, roundTripMs: seesRoundTrips ? (roundTripMs ?? null) : null }));
  },
});

export const devices = query({
  args: { groupId: v.id("groups") },
  handler: async (ctx, { groupId }) => {
    const { membership } = await requireMember(ctx, groupId);
    if (!canEditSongs(membership.role)) return null;
    const names = await displayNames(ctx, groupId);
    const latest = new Map<string, Doc<"presence">>();
    const withoutDevice = new Map<string, number>();
    for (const row of await groupScreens(ctx, groupId)) {
      if (row.deviceId === undefined) {
        withoutDevice.set(row.userId, Math.max(withoutDevice.get(row.userId) ?? 0, row.seenAt));
        continue;
      }
      const seen = latest.get(row.deviceId);
      if (seen === undefined || seen.seenAt < row.seenAt) latest.set(row.deviceId, row);
    }
    const named = new Set([...latest.values()].map((row) => row.userId as string));
    const now = Date.now();
    const remembered = new Map(
      (
        await ctx.db
          .query("groupDevices")
          .withIndex("by_group", (q) => q.eq("groupId", groupId))
          .collect()
      ).map((row) => [row.deviceId, row]),
    );
    const away = [...remembered.values()].filter((row) => !latest.has(row.deviceId) && names.has(row.userId) && now - row.seenAt <= AWAY_DEVICES_SHOWN_MS);
    return {
      devices: [
        ...[...latest.values()].map((row) => {
          const known = remembered.get(row.deviceId as string);
          return {
            deviceId: row.deviceId as string,
            deviceLabel: row.deviceLabel ?? "Device",
            userId: row.userId,
            displayName: names.get(row.userId) ?? "Member",
            nudgeMs: row.nudgeMs ?? null,
            pendingMs: known?.nudgeRequest?.ms ?? row.nudgeRequest?.ms ?? null,
            onPlay: row.onPlay,
            seenAt: row.seenAt,
          };
        }),
        ...away.map((row) => ({
          deviceId: row.deviceId,
          deviceLabel: row.deviceLabel,
          userId: row.userId,
          displayName: names.get(row.userId) ?? "Member",
          nudgeMs: row.nudgeMs ?? null,
          pendingMs: row.nudgeRequest?.ms ?? null,
          onPlay: false,
          seenAt: row.seenAt,
        })),
      ],
      olderApps: [...withoutDevice]
        .filter(([userId]) => !named.has(userId))
        .map(([userId, seenAt]) => ({ userId, displayName: names.get(userId) ?? "Member", seenAt })),
    };
  },
});

export const nudgeDevice = mutation({
  args: { groupId: v.id("groups"), deviceId: v.string(), nudgeMs: v.number() },
  handler: async (ctx, { groupId, deviceId, nudgeMs }) => {
    const { user } = await requireRole(ctx, groupId, "songManager");
    if (!isNudge(nudgeMs)) throw new ConvexError(`A Latency nudge is a whole number from ${LATENCY_MIN_MS} to ${LATENCY_MAX_MS} ms`);
    const now = Date.now();
    const screens = (await groupScreens(ctx, groupId)).filter((row) => row.deviceId === deviceId && now - row.seenAt <= FORGET_AFTER_MS);
    const known = await rememberedDevice(ctx, groupId, deviceId);
    const stillMember = known !== null && (await membershipOf(ctx, groupId, known.userId)) !== null;
    if (screens.length === 0 && !stillMember) throw new ConvexError("That device is no longer in this Group");
    const nudgeRequest = { id: `${now.toString(36)}${Math.random().toString(36).slice(2, 10)}`, ms: nudgeMs, by: user._id };
    await Promise.all(screens.map((row) => ctx.db.patch(row._id, { nudgeRequest })));
    if (known !== null) await ctx.db.patch(known._id, { nudgeRequest });
  },
});

export const myNudgeRequest = query({
  args: { groupId: v.id("groups"), screenId: v.string() },
  handler: async (ctx, { groupId, screenId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null || (await membershipOf(ctx, groupId, userId)) === null) return null;
    const row = await ctx.db
      .query("presence")
      .withIndex("by_group_user_screen", (q) => q.eq("groupId", groupId).eq("userId", userId).eq("screenId", screenId))
      .unique();
    const request = row?.nudgeRequest;
    if (request === undefined) return null;
    const by = await membershipOf(ctx, groupId, request.by);
    return { id: request.id, ms: request.ms, byName: by?.displayName ?? "An Admin" };
  },
});

export const nudgeApplied = mutation({
  args: { groupId: v.id("groups"), screenId: v.string(), id: v.string(), nudgeMs: v.number() },
  handler: async (ctx, { groupId, screenId, id, nudgeMs }) => {
    const user = await requireUser(ctx);
    if ((await membershipOf(ctx, groupId, user._id)) === null) return;
    const screen = await screenPresence(ctx, groupId, user._id, screenId);
    if (screen === null) return;
    await ctx.db.patch(screen._id, {
      ...(isNudge(nudgeMs) ? { nudgeMs } : {}),
      ...(screen.nudgeRequest?.id === id ? { nudgeRequest: undefined } : {}),
    });
    const known = screen.deviceId === undefined ? null : await rememberedDevice(ctx, groupId, screen.deviceId);
    if (known === null) return;
    await ctx.db.patch(known._id, {
      ...(isNudge(nudgeMs) ? { nudgeMs } : {}),
      ...(known.nudgeRequest?.id === id ? { nudgeRequest: undefined } : {}),
    });
  },
});

const SWEEP_PAGE = 100;

export const removeAbsentGuests = internalMutation({
  args: { cursor: v.optional(v.string()), cutoff: v.optional(v.number()), pageSize: v.optional(v.number()), role: v.optional(joinRoleValidator) },
  handler: async (ctx, { cursor, cutoff: sweepCutoff, pageSize, role: sweptRole }) => {
    const cutoff = sweepCutoff ?? Date.now() - GUEST_ABSENCE_MS;
    const role = sweptRole ?? JOIN_ROLES[0];
    const { page, isDone, continueCursor } = await ctx.db
      .query("memberships")
      .withIndex("by_role_seen", (q) => q.eq("role", role).lt("lastSeenAt", cutoff))
      .paginate({ cursor: cursor ?? null, numItems: pageSize ?? SWEEP_PAGE });
    for (const membership of page) {
      if (membership.lastSeenAt === undefined && membership._creationTime >= cutoff) continue;
      const user = await ctx.db.get(membership.userId);
      if (user !== null && !isGuest(user)) continue;
      const screens = await ctx.db
        .query("presence")
        .withIndex("by_group_user", (q) => q.eq("groupId", membership.groupId).eq("userId", membership.userId))
        .collect();
      if (screens.some((screen) => screen.seenAt >= cutoff)) continue;
      await Promise.all(screens.map((screen) => ctx.db.delete(screen._id)));
      await ctx.db.delete(membership._id);
      await forgetDevicesOf(ctx, membership.groupId, membership.userId);
      await forgetGuestIfGone(ctx, membership.userId);
    }
    const nextRole = JOIN_ROLES[JOIN_ROLES.indexOf(role) + 1];
    if (!isDone) await ctx.scheduler.runAfter(0, internal.presence.removeAbsentGuests, { cursor: continueCursor, cutoff, pageSize, role });
    else if (nextRole !== undefined) await ctx.scheduler.runAfter(0, internal.presence.removeAbsentGuests, { cutoff, pageSize, role: nextRole });
  },
});


export const forgetGuestsWhoNeverJoined = internalMutation({
  args: { cursor: v.optional(v.string()), pageSize: v.optional(v.number()) },
  handler: async (ctx, { cursor, pageSize }) => {
    const cutoff = Date.now() - GUEST_ABSENCE_MS;
    const { page, isDone, continueCursor } = await ctx.db.query("users").paginate({ cursor: cursor ?? null, numItems: pageSize ?? SWEEP_PAGE });
    for (const user of page) {
      if (!isGuest(user) || user._creationTime >= cutoff) continue;
      const memberships = await ctx.db
        .query("memberships")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .collect();
      if (memberships.some((membership) => (membership.lastSeenAt ?? membership._creationTime) >= cutoff)) continue;
      await forgetGuestIfGone(ctx, user._id);
    }
    if (!isDone) await ctx.scheduler.runAfter(0, internal.presence.forgetGuestsWhoNeverJoined, { cursor: continueCursor, pageSize });
  },
});

export const myGroupsSeen = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return { serverNow: Date.now(), groups: [] };
    const memberships = await ctx.db
      .query("memberships")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const serverNow = Date.now();
    const groups = await Promise.all(
      memberships.map(async ({ groupId }) => {
        const rows = await ctx.db
          .query("presence")
          .withIndex("by_group_seen", (q) => q.eq("groupId", groupId).gt("seenAt", serverNow - FORGET_AFTER_MS))
          .collect();
        const latest = new Map<string, number>();
        for (const row of rows) latest.set(row.userId, Math.max(latest.get(row.userId) ?? 0, row.seenAt));
        return { groupId, seenAt: [...latest.values()] };
      }),
    );
    return { serverNow, groups };
  },
});

export const forgetOldScreens = internalMutation({
  args: {},
  handler: async (ctx) => {
    const old = await ctx.db
      .query("presence")
      .withIndex("by_seen", (q) => q.lt("seenAt", Date.now() - FORGET_AFTER_MS))
      .take(FORGET_BATCH);
    for (const row of old) {
      const membership = await membershipOf(ctx, row.groupId, row.userId);
      if (membership !== null && (membership.lastSeenAt ?? 0) < row.seenAt) await ctx.db.patch(membership._id, { lastSeenAt: row.seenAt });
      await ctx.db.delete(row._id);
    }
  },
});

export const forgetOldDevices = internalMutation({
  args: {},
  handler: async (ctx) => {
    const old = await ctx.db
      .query("groupDevices")
      .withIndex("by_seen", (q) => q.lt("seenAt", Date.now() - FORGET_DEVICES_AFTER_MS))
      .take(FORGET_BATCH);
    await Promise.all(old.map((row) => ctx.db.delete(row._id)));
    if (old.length === FORGET_BATCH) await ctx.scheduler.runAfter(0, internal.presence.forgetOldDevices, {});
  },
});
