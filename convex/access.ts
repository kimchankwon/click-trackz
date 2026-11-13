import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError } from "convex/values";

import type { Doc, Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { groupLocked } from "./plans";
import { atLeast, ROLE_NAMES, seesSongLibrary, type Role } from "../src/lib/roles";

export async function requireUser(ctx: QueryCtx): Promise<Doc<"users">> {
  const userId = await getAuthUserId(ctx);
  const user = userId === null ? null : await ctx.db.get(userId);
  if (user === null) throw new ConvexError("Sign in first");
  return user;
}

export const isGuest = (user: Doc<"users">) => user.isAnonymous === true;

export async function membershipOf(ctx: QueryCtx, groupId: Id<"groups">, userId: Id<"users">) {
  return ctx.db
    .query("memberships")
    .withIndex("by_group_user", (q) => q.eq("groupId", groupId).eq("userId", userId))
    .unique();
}

export async function requireMember(ctx: QueryCtx, groupId: Id<"groups">) {
  const user = await requireUser(ctx);
  const membership = await membershipOf(ctx, groupId, user._id);
  if (membership === null) throw new ConvexError("You are not in this Group");
  return { user, membership };
}

export async function requireLibraryReader(ctx: QueryCtx, groupId: Id<"groups">) {
  const access = await requireMember(ctx, groupId);
  if (seesSongLibrary(access.membership.role, isGuest(access.user))) return access;
  const group = await ctx.db.get(groupId);
  if (group?.offline === true && group.createdBy === access.user._id) return access;
  throw new ConvexError("Sign in with Google to see the Group's Songs and Setlists");
}

const roleNeededMessage = (needed: Role) => (needed === "admin" ? "Only the Admin can do that" : `Only ${ROLE_NAMES[needed]}s and above can do that`);

export async function requireRole(ctx: QueryCtx, groupId: Id<"groups">, needed: Role) {
  const access = await requireMember(ctx, groupId);
  if (!atLeast(access.membership.role, needed)) throw new ConvexError(roleNeededMessage(needed));
  return access;
}

export const LOCKED_MESSAGE = "This Group is locked until its Admin renews their subscription";

export async function requireUnlocked(ctx: QueryCtx, groupId: Id<"groups">) {
  const group = await ctx.db.get(groupId);
  if (group === null) throw new ConvexError("That Group no longer exists");
  if (await groupLocked(ctx, group)) throw new ConvexError(LOCKED_MESSAGE);
  return group;
}

export async function requireRoleInUnlocked(ctx: QueryCtx, groupId: Id<"groups">, needed: Role) {
  const access = await requireRole(ctx, groupId, needed);
  const group = await requireUnlocked(ctx, groupId);
  return { ...access, group };
}
