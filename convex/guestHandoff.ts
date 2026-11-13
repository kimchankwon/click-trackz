import { ConvexError, v } from "convex/values";

import type { Doc, Id } from "./_generated/dataModel";
import { mutation, type MutationCtx } from "./_generated/server";
import { isGuest, membershipOf, requireUser } from "./access";
import { forgetGuestIfGone } from "./cleanup";
import { outranks } from "../src/lib/roles";

export const HANDOFF_MS = 30 * 60_000;

const newToken = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
};

async function dropHandoffs(ctx: MutationCtx, guestId: Id<"users">) {
  const handoffs = await ctx.db
    .query("guestHandoffs")
    .withIndex("by_guest", (q) => q.eq("guestId", guestId))
    .collect();
  await Promise.all(handoffs.map((handoff) => ctx.db.delete(handoff._id)));
}

export const start = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    if (!isGuest(user)) throw new ConvexError("Only a guest can hand their Groups to a Google account");
    await dropHandoffs(ctx, user._id);
    const token = newToken();
    await ctx.db.insert("guestHandoffs", { guestId: user._id, token, expiresAt: Date.now() + HANDOFF_MS });
    return token;
  },
});

async function moveMembership(ctx: MutationCtx, guestMembership: Doc<"memberships">, userId: Id<"users">) {
  const { groupId } = guestMembership;
  const existing = await membershipOf(ctx, groupId, userId);
  if (existing === null) {
    await ctx.db.patch(guestMembership._id, { userId });
  } else {
    const role = outranks(guestMembership.role, existing.role) ? guestMembership.role : existing.role;
    const lastSeenAt = Math.max(existing.lastSeenAt ?? 0, guestMembership.lastSeenAt ?? 0) || undefined;
    await ctx.db.patch(existing._id, { role, displayName: guestMembership.displayName, lastSeenAt });
    await ctx.db.delete(guestMembership._id);
  }
  const screens = await ctx.db
    .query("presence")
    .withIndex("by_group_user", (q) => q.eq("groupId", groupId).eq("userId", guestMembership.userId))
    .collect();
  await Promise.all(screens.map((screen) => ctx.db.delete(screen._id)));
  const playbacks = await ctx.db
    .query("playbacks")
    .withIndex("by_group", (q) => q.eq("groupId", groupId))
    .collect();
  for (const playback of playbacks) {
    const startedBy = playback.startedBy === guestMembership.userId ? userId : playback.startedBy;
    const stoppedBy = playback.stoppedBy === guestMembership.userId ? userId : playback.stoppedBy;
    if (startedBy !== playback.startedBy || stoppedBy !== playback.stoppedBy) await ctx.db.patch(playback._id, { startedBy, stoppedBy });
  }
}

export const claim = mutation({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const user = await requireUser(ctx);
    if (isGuest(user)) throw new ConvexError("Sign in with Google first");
    const handoff = await ctx.db
      .query("guestHandoffs")
      .withIndex("by_token", (q) => q.eq("token", token))
      .unique();
    if (handoff === null) return 0;
    await ctx.db.delete(handoff._id);
    if (handoff.expiresAt <= Date.now() || handoff.guestId === user._id) return 0;
    const memberships = await ctx.db
      .query("memberships")
      .withIndex("by_user", (q) => q.eq("userId", handoff.guestId))
      .collect();
    let moved = 0;
    for (const membership of memberships) {
      const group = await ctx.db.get(membership.groupId);
      if (group === null || group.offline === true) continue;
      await moveMembership(ctx, membership, user._id);
      moved += 1;
    }
    await forgetGuestIfGone(ctx, handoff.guestId);
    return moved;
  },
});
