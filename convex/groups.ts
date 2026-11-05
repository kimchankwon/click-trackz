import { ConvexError, v } from "convex/values";

import { mutation, query, type MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { isGuest, membershipOf, requireAdmin, requireMember, requireUser } from "./access";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 6;

const cleanName = (value: string, what: string) => {
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > 40) throw new ConvexError(`${what} must be 1 to 40 characters`);
  return trimmed;
};

async function uniqueJoinCode(ctx: MutationCtx) {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = Array.from({ length: CODE_LENGTH }, () => CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]).join("");
    const taken = await ctx.db
      .query("groups")
      .withIndex("by_join_code", (q) => q.eq("joinCode", code))
      .unique();
    if (taken === null) return code;
  }
  throw new ConvexError("Could not create a join code, try again");
}

export const createGroup = mutation({
  args: { name: v.string(), displayName: v.string() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    if (isGuest(user)) throw new ConvexError("Sign in with Google or Apple to create a Group");
    const joinCode = await uniqueJoinCode(ctx);
    const groupId = await ctx.db.insert("groups", {
      name: cleanName(args.name, "Group name"),
      joinCode,
      createdBy: user._id,
    });
    await ctx.db.insert("memberships", {
      groupId,
      userId: user._id,
      role: "admin",
      displayName: cleanName(args.displayName, "Your name"),
    });
    return { groupId, joinCode };
  },
});

export const members = query({
  args: { groupId: v.id("groups") },
  handler: async (ctx, { groupId }) => {
    await requireMember(ctx, groupId);
    const memberships = await ctx.db
      .query("memberships")
      .withIndex("by_group", (q) => q.eq("groupId", groupId))
      .collect();
    return Promise.all(
      memberships.map(async (membership) => {
        const user = await ctx.db.get(membership.userId);
        return {
          userId: membership.userId,
          displayName: membership.displayName,
          role: membership.role,
          isGuest: user === null || isGuest(user),
        };
      }),
    );
  },
});

export const joinGroup = mutation({
  args: { joinCode: v.string(), displayName: v.string() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const group = await ctx.db
      .query("groups")
      .withIndex("by_join_code", (q) => q.eq("joinCode", args.joinCode.trim().toUpperCase()))
      .unique();
    if (group === null) throw new ConvexError("No Group has that code");
    const existing = await ctx.db
      .query("memberships")
      .withIndex("by_group_user", (q) => q.eq("groupId", group._id).eq("userId", user._id))
      .unique();
    if (existing === null) {
      await ctx.db.insert("memberships", {
        groupId: group._id,
        userId: user._id,
        role: "member",
        displayName: cleanName(args.displayName, "Your name"),
      });
    }
    return group._id;
  },
});

async function adminCount(ctx: MutationCtx, groupId: Id<"groups">) {
  const memberships = await ctx.db
    .query("memberships")
    .withIndex("by_group", (q) => q.eq("groupId", groupId))
    .collect();
  return memberships.filter((m) => m.role === "admin").length;
}

export const setRole = mutation({
  args: {
    groupId: v.id("groups"),
    userId: v.id("users"),
    role: v.union(v.literal("admin"), v.literal("member")),
  },
  handler: async (ctx, { groupId, userId, role }) => {
    await requireAdmin(ctx, groupId);
    const target = await membershipOf(ctx, groupId, userId);
    if (target === null) throw new ConvexError("That person is not in this Group");
    if (target.role === role) return;
    if (role === "admin") {
      const user = await ctx.db.get(userId);
      if (user === null || isGuest(user)) throw new ConvexError("Admins must sign in with Google or Apple first");
    } else if ((await adminCount(ctx, groupId)) <= 1) {
      throw new ConvexError("A Group needs at least one Admin; promote someone else before stepping down as the last Admin");
    }
    await ctx.db.patch(target._id, { role });
  },
});

export const leaveGroup = mutation({
  args: { groupId: v.id("groups") },
  handler: async (ctx, { groupId }) => {
    const { membership } = await requireMember(ctx, groupId);
    if (membership.role === "admin" && (await adminCount(ctx, groupId)) <= 1) {
      throw new ConvexError("A Group needs at least one Admin; promote someone else before leaving as the last Admin");
    }
    await ctx.db.delete(membership._id);
  },
});

export const myGroups = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const memberships = await ctx.db
      .query("memberships")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    const groups = await Promise.all(
      memberships.map(async (membership) => {
        const group = await ctx.db.get(membership.groupId);
        if (group === null) return null;
        return {
          groupId: group._id,
          name: group.name,
          role: membership.role,
          joinCode: membership.role === "admin" ? group.joinCode : null,
        };
      }),
    );
    return groups.filter((g) => g !== null);
  },
});
