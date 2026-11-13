import { ConvexError, v } from "convex/values";

import { mutation, query } from "./_generated/server";
import { requireMember, requireRoleInUnlocked, requireLibraryReader } from "./access";
import { logActivity } from "./activity";
import { touchLibrary } from "./library";
import { setlistChanges } from "../src/activity/changes";

const cleanName = (name: string) => {
  const trimmed = name.trim();
  if (trimmed.length === 0 || trimmed.length > 60) throw new ConvexError("Setlist name must be 1 to 60 characters");
  return trimmed;
};

export const createSetlist = mutation({
  args: { groupId: v.id("groups"), name: v.string() },
  handler: async (ctx, { groupId, name }) => {
    const { membership } = await requireRoleInUnlocked(ctx, groupId, "songManager");
    const cleaned = cleanName(name);
    const setlistId = await ctx.db.insert("setlists", { groupId, name: cleaned, entries: [] });
    await touchLibrary(ctx, groupId);
    await logActivity(ctx, membership, "setlist", `Added the Setlist ${cleaned}`);
    return setlistId;
  },
});

export const list = query({
  args: { groupId: v.id("groups") },
  handler: async (ctx, { groupId }) => {
    await requireLibraryReader(ctx, groupId);
    const group = await ctx.db.get(groupId);
    const setlists = await ctx.db
      .query("setlists")
      .withIndex("by_group", (q) => q.eq("groupId", groupId))
      .collect();
    return setlists.map((setlist) => ({
      setlistId: setlist._id,
      name: setlist.name,
      songCount: setlist.entries.length,
      isCurrent: group?.currentSetlistId === setlist._id,
    }));
  },
});

export const setCurrent = mutation({
  args: { groupId: v.id("groups"), setlistId: v.union(v.id("setlists"), v.null()) },
  handler: async (ctx, { groupId, setlistId }) => {
    const { membership, group } = await requireRoleInUnlocked(ctx, groupId, "songManager");
    const setlist = setlistId === null ? null : await ctx.db.get(setlistId);
    if (setlistId !== null && (setlist === null || setlist.groupId !== groupId)) throw new ConvexError("That Setlist is not in this Group");
    await ctx.db.patch(groupId, { currentSetlistId: setlistId ?? undefined });
    await touchLibrary(ctx, groupId);
    if ((group.currentSetlistId ?? null) === setlistId) return;
    const previous = group.currentSetlistId === undefined ? null : await ctx.db.get(group.currentSetlistId);
    await logActivity(
      ctx,
      membership,
      "setlist",
      setlist === null ? `Cleared ${previous?.name ?? "the Setlist"} as the Current setlist` : `Made ${setlist.name} the Current setlist`,
    );
  },
});

const cleanNote = (value: string | undefined, what: string) => {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  if (trimmed.length > 30) throw new ConvexError(`${what} must be 30 characters or fewer`);
  return trimmed;
};

export const save = mutation({
  args: {
    setlistId: v.id("setlists"),
    revision: v.number(),
    name: v.string(),
    entries: v.array(v.object({ songId: v.id("songs"), key: v.optional(v.string()), leader: v.optional(v.string()) })),
  },
  handler: async (ctx, { setlistId, revision, name, entries }) => {
    const setlist = await ctx.db.get(setlistId);
    if (setlist === null) throw new ConvexError("That Setlist no longer exists");
    const { membership } = await requireRoleInUnlocked(ctx, setlist.groupId, "songManager");
    const current = setlist.revision ?? 0;
    if (current !== revision) {
      throw new ConvexError("Someone else changed this Setlist after you opened it. Load their changes, then save again.");
    }
    if (entries.length > 100) throw new ConvexError("A Setlist can have at most 100 Songs");
    const titles = new Map<string, string>();
    const cleaned = await Promise.all(
      entries.map(async (entry) => {
        const song = await ctx.db.get(entry.songId);
        if (song === null || song.groupId !== setlist.groupId) throw new ConvexError("That Song is not in this Group");
        titles.set(song._id, song.title);
        return { songId: entry.songId, key: cleanNote(entry.key, "Key"), leader: cleanNote(entry.leader, "Leader") };
      }),
    );
    const cleanedName = cleanName(name);
    await ctx.db.patch(setlistId, { name: cleanedName, entries: cleaned, revision: current + 1 });
    await touchLibrary(ctx, setlist.groupId);
    for (const entry of setlist.entries) {
      if (!titles.has(entry.songId)) titles.set(entry.songId, (await ctx.db.get(entry.songId))?.title ?? "a deleted Song");
    }
    const details = setlistChanges(setlist, { name: cleanedName, entries: cleaned }, (songId) => titles.get(songId) ?? "a Song");
    if (details.length > 0) await logActivity(ctx, membership, "setlist", `Edited the Setlist ${cleanedName}`, details);
  },
});

export const get = query({
  args: { setlistId: v.id("setlists") },
  handler: async (ctx, { setlistId }) => {
    const setlist = await ctx.db.get(setlistId);
    if (setlist === null) return null;
    await requireMember(ctx, setlist.groupId);
    const entries = await Promise.all(
      setlist.entries.map(async (entry) => {
        const song = await ctx.db.get(entry.songId);
        if (song === null) return null;
        return {
          songId: entry.songId,
          title: song.title,
          key: entry.key ?? null,
          leader: entry.leader ?? null,
          needsStructure: song.sections.length === 0,
        };
      }),
    );
    return { setlistId, name: setlist.name, revision: setlist.revision ?? 0, entries: entries.filter((entry) => entry !== null) };
  },
});

export const deleteSetlist = mutation({
  args: { setlistId: v.id("setlists") },
  handler: async (ctx, { setlistId }) => {
    const setlist = await ctx.db.get(setlistId);
    if (setlist === null) return;
    const { membership } = await requireRoleInUnlocked(ctx, setlist.groupId, "songManager");
    const group = await ctx.db.get(setlist.groupId);
    if (group?.currentSetlistId === setlistId) await ctx.db.patch(group._id, { currentSetlistId: undefined });
    await ctx.db.delete(setlistId);
    await touchLibrary(ctx, setlist.groupId);
    await logActivity(ctx, membership, "setlist", `Deleted the Setlist ${setlist.name}`);
  },
});

export const currentSetlistId = query({
  args: { groupId: v.id("groups") },
  handler: async (ctx, { groupId }) => {
    await requireMember(ctx, groupId);
    return (await ctx.db.get(groupId))?.currentSetlistId ?? null;
  },
});
