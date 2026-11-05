import { ConvexError, v } from "convex/values";

import { isBuiltinSectionType } from "../src/sync/cue-vocabulary";
import type { Doc } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { requireAdmin, requireMember } from "./access";

const cleanTitle = (title: string) => {
  const trimmed = title.trim();
  if (trimmed.length === 0 || trimmed.length > 80) throw new ConvexError("Song title must be 1 to 80 characters");
  return trimmed;
};

const cleanKey = (key: string | undefined) => {
  const trimmed = key?.trim();
  if (!trimmed) return undefined;
  if (trimmed.length > 8) throw new ConvexError("Key must be 8 characters or fewer");
  return trimmed;
};

export const createSong = mutation({
  args: { groupId: v.id("groups"), title: v.string(), key: v.optional(v.string()) },
  handler: async (ctx, { groupId, title, key }) => {
    await requireAdmin(ctx, groupId);
    return ctx.db.insert("songs", { groupId, title: cleanTitle(title), key: cleanKey(key), countIn: true, sections: [] });
  },
});

export const list = query({
  args: { groupId: v.id("groups") },
  handler: async (ctx, { groupId }) => {
    await requireMember(ctx, groupId);
    const songs = await ctx.db
      .query("songs")
      .withIndex("by_group", (q) => q.eq("groupId", groupId))
      .collect();
    return songs.map((song) => ({
      songId: song._id,
      title: song.title,
      key: song.key ?? null,
      countIn: song.countIn,
      sectionCount: song.sections.length,
    }));
  },
});

const sectionValidator = v.object({
  sectionType: v.string(),
  number: v.optional(v.number()),
  bars: v.number(),
  beatsPerBar: v.number(),
  bpm: v.number(),
  voiceCueEnabled: v.optional(v.boolean()),
  customLabel: v.optional(v.string()),
});

type Section = Doc<"songs">["sections"][number];

const wholeBetween = (value: number, min: number, max: number) => Number.isInteger(value) && value >= min && value <= max;

function checkSection(section: Section, index: number) {
  const where = `Section ${index + 1}`;
  if (!isBuiltinSectionType(section.sectionType)) throw new ConvexError(`${where}: Section type is not in the Cue vocabulary`);
  if (section.number !== undefined && !wholeBetween(section.number, 1, 9)) throw new ConvexError(`${where}: number must be 1 to 9`);
  if (!wholeBetween(section.bars, 1, 64)) throw new ConvexError(`${where}: Bars must be a whole number from 1 to 64`);
  if (!wholeBetween(section.beatsPerBar, 1, 12)) throw new ConvexError(`${where}: Beats per bar must be a whole number from 1 to 12`);
  if (!(section.bpm >= 30 && section.bpm <= 300)) throw new ConvexError(`${where}: BPM must be from 30 to 300`);
  if (section.customLabel !== undefined && section.customLabel.trim().length > 20) {
    throw new ConvexError(`${where}: Custom label must be 20 characters or fewer`);
  }
}

export const updateSong = mutation({
  args: {
    songId: v.id("songs"),
    title: v.optional(v.string()),
    key: v.optional(v.string()),
    countIn: v.optional(v.boolean()),
    sections: v.optional(v.array(sectionValidator)),
  },
  handler: async (ctx, { songId, title, key, countIn, sections }) => {
    const song = await ctx.db.get(songId);
    if (song === null) throw new ConvexError("That Song no longer exists");
    await requireAdmin(ctx, song.groupId);
    if (sections !== undefined && sections.length > 64) throw new ConvexError("A Song can have at most 64 Sections");
    sections?.forEach(checkSection);
    await ctx.db.patch(songId, {
      ...(title !== undefined ? { title: cleanTitle(title) } : {}),
      ...(key !== undefined ? { key: cleanKey(key) } : {}),
      ...(countIn !== undefined ? { countIn } : {}),
      ...(sections !== undefined ? { sections } : {}),
    });
  },
});

export const get = query({
  args: { songId: v.id("songs") },
  handler: async (ctx, { songId }) => {
    const song = await ctx.db.get(songId);
    if (song === null) return null;
    await requireMember(ctx, song.groupId);
    return { songId: song._id, title: song.title, key: song.key ?? null, countIn: song.countIn, sections: song.sections };
  },
});

export const deleteSong = mutation({
  args: { songId: v.id("songs") },
  handler: async (ctx, { songId }) => {
    const song = await ctx.db.get(songId);
    if (song === null) return;
    await requireAdmin(ctx, song.groupId);
    await ctx.db.delete(songId);
  },
});
