import { ConvexError } from "convex/values";

import type { Doc, Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { betterPlan, canAddLibrarySongs, canAddSongs, canCreateGroup, isGroupLocked, planLimits, PLAN_NAMES, type Plan } from "../src/lib/plans";

const emailsIn = (value: string | undefined) =>
  new Set(
    (value ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter((email) => email.length > 0),
  );

export function compedPlan(email: string | undefined, env: Record<string, string | undefined> = process.env): Plan {
  const normalized = email?.trim().toLowerCase();
  if (!normalized) return "free";
  if (emailsIn(env.COMP_PRO_EMAILS).has(normalized)) return "pro";
  if (emailsIn(env.COMP_PLUS_EMAILS).has(normalized)) return "plus";
  return "free";
}

export const subscriptionActive = (row: Pick<Doc<"subscriptions">, "expiresAt">, nowMs: number) => row.expiresAt === null || row.expiresAt > nowMs;

export async function planOf(ctx: QueryCtx, userId: Id<"users">): Promise<Plan> {
  const user = await ctx.db.get(userId);
  if (user === null || user.isAnonymous === true) return "free";
  const row = await ctx.db
    .query("subscriptions")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique();
  const paid = row !== null && subscriptionActive(row, Date.now()) ? row.plan : "free";
  return betterPlan(paid, compedPlan(user.email));
}

export async function ownedGroups(ctx: QueryCtx, userId: Id<"users">) {
  const groups = await ctx.db
    .query("groups")
    .withIndex("by_created_by", (q) => q.eq("createdBy", userId))
    .collect();
  return groups.filter((group) => group.offline !== true).sort((a, b) => a._creationTime - b._creationTime);
}

export async function groupLocked(ctx: QueryCtx, group: Doc<"groups">) {
  if (group.offline === true) return false;
  const plan = await planOf(ctx, group.createdBy);
  if (planLimits(plan).groups === null) return false;
  const owned = await ownedGroups(ctx, group.createdBy);
  return isGroupLocked(plan, owned.findIndex((other) => other._id === group._id));
}

async function ownedSongCount(ctx: QueryCtx, groups: readonly Doc<"groups">[]) {
  const counts = await Promise.all(groups.map((group) => songCountIn(ctx, group._id)));
  return counts.reduce((sum, count) => sum + count, 0);
}

export async function requireRoomForGroup(ctx: QueryCtx, userId: Id<"users">) {
  const plan = await planOf(ctx, userId);
  if (plan === "free") throw new ConvexError("Subscribe to Plus or Pro to create a Group");
  const owned = await ownedGroups(ctx, userId);
  if (!canCreateGroup(plan, owned.length)) throw new ConvexError(`${PLAN_NAMES[plan]} includes ${planLimits(plan).groups} Groups; upgrade to Pro for more`);
}

export async function requireOwnerRoomForSongs(ctx: QueryCtx, ownerId: Id<"users">, adding: number, whose: "mine" | "admin") {
  const plan = await planOf(ctx, ownerId);
  const limit = planLimits(plan).songs;
  if (limit === null) return;
  const count = await ownedSongCount(ctx, await ownedGroups(ctx, ownerId));
  if (canAddSongs(plan, count, adding)) return;
  const who = whose === "mine" ? "You have" : "This Group's Admin has";
  throw new ConvexError(`${who} reached the ${limit} Songs ${PLAN_NAMES[plan]} includes; upgrade to Pro for more`);
}

async function songCountIn(ctx: QueryCtx, groupId: Id<"groups">) {
  return (await ctx.db.query("songs").withIndex("by_group", (q) => q.eq("groupId", groupId)).collect()).length;
}

async function requireRoomInLibrary(ctx: QueryCtx, library: Doc<"groups">, adding: number) {
  const plan = await planOf(ctx, library.createdBy);
  if (canAddLibrarySongs(plan, await songCountIn(ctx, library._id), adding)) return;
  const limit = planLimits(plan).librarySongs;
  throw new ConvexError(plan === "free" ? `My Library holds ${limit} Songs on Free; subscribe to Plus or Pro for 1000` : `My Library holds up to ${limit} Songs`);
}

export async function requireRoomForSongs(ctx: QueryCtx, group: Doc<"groups">, adding: number) {
  if (group.offline === true) return requireRoomInLibrary(ctx, group, adding);
  await requireOwnerRoomForSongs(ctx, group.createdBy, adding, "admin");
}

export async function usageOf(ctx: QueryCtx, userId: Id<"users">) {
  const plan = await planOf(ctx, userId);
  const owned = await ownedGroups(ctx, userId);
  const created = await ctx.db
    .query("groups")
    .withIndex("by_created_by", (q) => q.eq("createdBy", userId))
    .collect();
  const library = created.find((group) => group.offline === true);
  return {
    plan,
    limits: planLimits(plan),
    groups: owned.length,
    songs: await ownedSongCount(ctx, owned),
    librarySongs: library ? await songCountIn(ctx, library._id) : 0,
  };
}
