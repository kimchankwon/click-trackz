import { ConvexError, v } from "convex/values";

import { mutation, query, type MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { isGuest, membershipOf, requireMember, requireRole, requireUser } from "./access";
import { deleteGroupRows } from "./cleanup";
import { groupLocked, requireOwnerRoomForSongs, requireRoomForGroup } from "./plans";
import { roleValidator } from "./schema";
import { songCopyFields } from "./songs";
import { copyBaseOf, copyTitle, MAX_GROUP_NAME } from "../src/lib/copy-title";
import { canAssignRole, canManageGroup, outranks } from "../src/lib/roles";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 6;

const cleanName = (value: string, what: string) => {
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_GROUP_NAME) throw new ConvexError(`${what} must be 1 to ${MAX_GROUP_NAME} characters`);
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
    if (isGuest(user)) throw new ConvexError("Sign in with Google to create a Group");
    await requireRoomForGroup(ctx, user._id);
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

export const duplicateGroup = mutation({
  args: { groupId: v.id("groups") },
  handler: async (ctx, { groupId }) => {
    const { user, membership } = await requireRole(ctx, groupId, "groupManager");
    if (isGuest(user)) throw new ConvexError("Sign in with Google to create a Group");
    const group = await ctx.db.get(groupId);
    if (group === null) throw new ConvexError("That Group no longer exists");
    if (group.offline === true) throw new ConvexError("My Library cannot be duplicated");
    await requireRoomForGroup(ctx, user._id);
    const songs = await ctx.db
      .query("songs")
      .withIndex("by_group", (q) => q.eq("groupId", groupId))
      .collect();
    await requireOwnerRoomForSongs(ctx, user._id, songs.length, "mine");
    const mine = await ctx.db
      .query("memberships")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    const myGroupNames = (await Promise.all(mine.map((other) => ctx.db.get(other.groupId)))).flatMap((other) => (other ? [other.name] : []));
    const copyBase = copyBaseOf({ title: group.name, copyBase: group.copyBase });
    const name = copyTitle(copyBase, myGroupNames, MAX_GROUP_NAME);
    const copyId = await ctx.db.insert("groups", { name, joinCode: await uniqueJoinCode(ctx), createdBy: user._id, copyBase });
    await ctx.db.insert("memberships", { groupId: copyId, userId: user._id, role: "admin", displayName: membership.displayName });
    const copiedSongs = new Map<Id<"songs">, Id<"songs">>();
    for (const song of songs) copiedSongs.set(song._id, await ctx.db.insert("songs", { ...songCopyFields(song), groupId: copyId, title: song.title }));
    const setlists = await ctx.db
      .query("setlists")
      .withIndex("by_group", (q) => q.eq("groupId", groupId))
      .collect();
    for (const setlist of setlists) {
      const entries = setlist.entries.flatMap((entry) => {
        const songId = copiedSongs.get(entry.songId);
        return songId ? [{ ...entry, songId }] : [];
      });
      const setlistId = await ctx.db.insert("setlists", { groupId: copyId, name: setlist.name, entries });
      if (group.currentSetlistId === setlist._id) await ctx.db.patch(copyId, { currentSetlistId: setlistId });
    }
    return { groupId: copyId, name };
  },
});

export const rename = mutation({
  args: { groupId: v.id("groups"), name: v.string() },
  handler: async (ctx, { groupId, name }) => {
    await requireRole(ctx, groupId, "groupManager");
    const group = await ctx.db.get(groupId);
    if (group === null) throw new ConvexError("That Group no longer exists");
    if (group.offline === true) throw new ConvexError("My Library cannot be renamed");
    await ctx.db.patch(groupId, { name: cleanName(name, "Group name"), copyBase: undefined });
  },
});

export const deleteGroup = mutation({
  args: { groupId: v.id("groups") },
  handler: async (ctx, { groupId }) => {
    await requireRole(ctx, groupId, "admin");
    const group = await ctx.db.get(groupId);
    if (group === null) throw new ConvexError("That Group no longer exists");
    if (group.offline === true) throw new ConvexError("My Library cannot be deleted");
    await deleteGroupRows(ctx, groupId);
  },
});

const LIBRARY_NAME = "My Library";

export const openOffline = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const memberships = await ctx.db
      .query("memberships")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    for (const membership of memberships) {
      const group = await ctx.db.get(membership.groupId);
      if (group?.offline === true && group.createdBy === user._id) return group._id;
    }
    const groupId = await ctx.db.insert("groups", {
      name: LIBRARY_NAME,
      joinCode: await uniqueJoinCode(ctx),
      createdBy: user._id,
      offline: true,
    });
    await ctx.db.insert("memberships", { groupId, userId: user._id, role: "admin", displayName: "You" });
    return groupId;
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
          lastSeenAt: membership.lastSeenAt ?? null,
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
    if (group === null || group.offline === true) throw new ConvexError("No Group has that code");
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

export const setRole = mutation({
  args: { groupId: v.id("groups"), userId: v.id("users"), role: roleValidator },
  handler: async (ctx, { groupId, userId, role }) => {
    const { user: caller, membership: mine } = await requireRole(ctx, groupId, "groupManager");
    if (userId === caller._id) throw new ConvexError("You cannot change your own Role");
    if (role === "admin") throw new ConvexError("Only the person who created the Group can be its Admin");
    const target = await membershipOf(ctx, groupId, userId);
    if (target === null) throw new ConvexError("That person is not in this Group");
    if (target.role === role) return;
    if (!canAssignRole(mine.role, target.role, role)) throw new ConvexError("You can only give Roles below your own, to people below you");
    if (role !== "member") {
      const user = await ctx.db.get(userId);
      if (user === null || isGuest(user)) throw new ConvexError("Guests must sign in with Google before they can have a Role");
    }
    await ctx.db.patch(target._id, { role });
  },
});

export const removeMember = mutation({
  args: { groupId: v.id("groups"), userId: v.id("users") },
  handler: async (ctx, { groupId, userId }) => {
    const { user, membership: mine } = await requireRole(ctx, groupId, "groupManager");
    if (userId === user._id) throw new ConvexError("Use Leave Group to leave yourself");
    const target = await membershipOf(ctx, groupId, userId);
    if (target === null) throw new ConvexError("That person is not in this Group");
    if (!outranks(mine.role, target.role)) throw new ConvexError("You can only remove people below you");
    await ctx.db.delete(target._id);
    const presence = await ctx.db
      .query("presence")
      .withIndex("by_group_user", (q) => q.eq("groupId", groupId).eq("userId", userId))
      .collect();
    await Promise.all(presence.map((row) => ctx.db.delete(row._id)));
  },
});

export const setMemberName = mutation({
  args: { groupId: v.id("groups"), userId: v.id("users"), displayName: v.string() },
  handler: async (ctx, { groupId, userId, displayName }) => {
    const { user, membership: mine } = await requireRole(ctx, groupId, "groupManager");
    const target = userId === user._id ? mine : await membershipOf(ctx, groupId, userId);
    if (target === null) throw new ConvexError("That person is not in this Group");
    if (target !== mine && !outranks(mine.role, target.role)) throw new ConvexError("You can only rename people below you");
    await ctx.db.patch(target._id, { displayName: cleanName(displayName, "Name") });
  },
});

export const setDisplayName = mutation({
  args: { groupId: v.id("groups"), displayName: v.string() },
  handler: async (ctx, { groupId, displayName }) => {
    const { membership } = await requireMember(ctx, groupId);
    await ctx.db.patch(membership._id, { displayName: cleanName(displayName, "Your name") });
  },
});

export const leaveGroup = mutation({
  args: { groupId: v.id("groups") },
  handler: async (ctx, { groupId }) => {
    const { membership } = await requireMember(ctx, groupId);
    if (membership.role === "admin") throw new ConvexError("The Admin cannot leave their own Group; delete it instead");
    await ctx.db.delete(membership._id);
    const presence = await ctx.db
      .query("presence")
      .withIndex("by_group_user", (q) => q.eq("groupId", groupId).eq("userId", membership.userId))
      .collect();
    await Promise.all(presence.map((row) => ctx.db.delete(row._id)));
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
          offline: group.offline === true,
          copyBase: group.copyBase ?? null,
          locked: await groupLocked(ctx, group),
          guest: isGuest(user),
          owned: group.createdBy === user._id,
          joinCode: canManageGroup(membership.role) && group.offline !== true ? group.joinCode : null,
        };
      }),
    );
    return groups.filter((g) => g !== null);
  },
});
