import { ConvexError, v } from "convex/values";

import { internalMutation } from "./_generated/server";
import { touchLibrary } from "./library";

const firstSetlist = [
  { title: "Send Me Out", key: "B?", leader: "Jason", bpm: 144, beatsPerBar: 4 },
  { title: "You Alone", key: "D", leader: "Joanne", bpm: 70, beatsPerBar: 4 },
  { title: "Unashamed", key: "F", leader: "Jisue", bpm: 77, beatsPerBar: 4 },
  { title: "I Speak Jesus", key: "D", leader: "Jisue", bpm: 74, beatsPerBar: 4 },
  { title: "Pure", key: "D", leader: "Jisue", bpm: 78, beatsPerBar: 4 },
  { title: "Kingdom Come", leader: "Minwoo", bpm: 75, beatsPerBar: 4 },
  { title: "Promises", leader: "Minwoo", bpm: 258, beatsPerBar: 6 },
  { title: "Remembrance", key: "E", leader: "Jisue", bpm: 70, beatsPerBar: 4 },
  { title: "Here I Bow", key: "Eb", leader: "Joanne", bpm: 69, beatsPerBar: 4 },
  { title: "So Will I", key: "D", leader: "Joanne", bpm: 64, beatsPerBar: 4 },
  { title: "Lion and the Lamb", key: "D", leader: "Minwoo", bpm: 90, beatsPerBar: 4 },
  { title: "O Come to the Altar", key: "G", leader: "Jason", bpm: 210, beatsPerBar: 6 },
  { title: "Pride of a Father", leader: "Jason", bpm: 71, beatsPerBar: 4 },
  { title: "A Thousand Hallelujahs", key: "C", leader: "Joanne", bpm: 68, beatsPerBar: 4 },
  { title: "Beautiful Saviour", key: "E", leader: "Jason", bpm: 156, beatsPerBar: 6 },
];

export const firstSetlistForGroup = internalMutation({
  args: { groupId: v.id("groups"), name: v.optional(v.string()) },
  handler: async (ctx, { groupId, name }) => {
    const group = await ctx.db.get(groupId);
    if (group === null) throw new ConvexError("No such Group");
    const existing = await ctx.db
      .query("songs")
      .withIndex("by_group", (q) => q.eq("groupId", groupId))
      .collect();
    const byTitle = new Map(existing.map((song) => [song.title, song]));
    const entries = [];
    for (const song of firstSetlist) {
      const tempoHint = { bpm: song.bpm, beatsPerBar: song.beatsPerBar };
      const reused = byTitle.get(song.title);
      if (reused && reused.tempoHint === undefined) await ctx.db.patch(reused._id, { tempoHint });
      const songId =
        reused?._id ??
        (await ctx.db.insert("songs", {
          groupId,
          title: song.title,
          key: song.key,
          tempoHint,
          countIn: true,
          sections: [],
        }));
      entries.push({ songId, key: song.key, leader: song.leader });
    }
    const setlistId = await ctx.db.insert("setlists", { groupId, name: name ?? "First Setlist", entries });
    await ctx.db.patch(groupId, { currentSetlistId: setlistId });
    await touchLibrary(ctx, groupId);
    return { setlistId, songs: entries.length };
  },
});
