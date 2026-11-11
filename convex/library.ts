import { ConvexError, v } from "convex/values";

import { query } from "./_generated/server";
import { requireMember } from "./access";
import { songView } from "../src/library/song-views";

export const snapshot = query({
  args: { groupId: v.id("groups") },
  handler: async (ctx, { groupId }) => {
    const { user } = await requireMember(ctx, groupId);
    const group = await ctx.db.get(groupId);
    if (group === null || group.offline !== true || group.createdBy !== user._id) throw new ConvexError("Only My Library is kept on this device");
    const songs = await ctx.db
      .query("songs")
      .withIndex("by_group", (q) => q.eq("groupId", groupId))
      .collect();
    const setlists = await ctx.db
      .query("setlists")
      .withIndex("by_group", (q) => q.eq("groupId", groupId))
      .collect();
    return {
      groupId,
      name: group.name,
      currentSetlistId: group.currentSetlistId ?? null,
      songs: songs.map(songView),
      setlists: setlists.map((setlist) => ({
        setlistId: setlist._id,
        name: setlist.name,
        revision: setlist.revision ?? 0,
        entries: setlist.entries.map((entry) => ({ songId: entry.songId, key: entry.key ?? null, leader: entry.leader ?? null })),
      })),
    };
  },
});
