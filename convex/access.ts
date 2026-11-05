import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError } from "convex/values";

import type { Doc, Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";

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

export async function requireAdmin(ctx: QueryCtx, groupId: Id<"groups">) {
  const access = await requireMember(ctx, groupId);
  if (access.membership.role !== "admin") throw new ConvexError("Only Admins can do that");
  return access;
}
