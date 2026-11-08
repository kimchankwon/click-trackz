import { ConvexError, v } from "convex/values";

import type { Doc } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { requireAdmin, requireMember } from "./access";
import { groupVocabulary } from "./vocabulary";
import { BEAT_UNITS, SUBDIVISIONS, subdivisionOf } from "../src/sync/timeline";
import { sectionFields } from "./schema";
import { commonBpm, markOwnTempos, withSongTempo } from "../src/sync/song-tempo";

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

const sectionValidator = sectionFields;

type Section = Doc<"songs">["sections"][number];

const wholeBetween = (value: number, min: number, max: number) => Number.isInteger(value) && value >= min && value <= max;

const validBpm = (bpm: number) => bpm >= 30 && bpm <= 300;

function checkSection(section: Section, index: number, vocabulary: ReadonlySet<string>) {
  const where = `Section ${index + 1}`;
  if (!vocabulary.has(section.sectionType)) throw new ConvexError(`${where}: Section type is not in the Cue vocabulary`);
  if (section.number !== undefined && !wholeBetween(section.number, 1, 9)) throw new ConvexError(`${where}: number must be 1 to 9`);
  if (!wholeBetween(section.bars, 1, 64)) throw new ConvexError(`${where}: Bars must be a whole number from 1 to 64`);
  if (!wholeBetween(section.beatsPerBar, 1, 12)) throw new ConvexError(`${where}: Beats per bar must be a whole number from 1 to 12`);
  if (section.beatUnit !== undefined && !BEAT_UNITS.some((unit) => unit === section.beatUnit)) {
    throw new ConvexError(`${where}: The time signature must count halves, quarters, eighths or sixteenths`);
  }
  if (!validBpm(section.bpm)) throw new ConvexError(`${where}: BPM must be from 30 to 300`);
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
    subdivision: v.optional(v.number()),
    bpm: v.optional(v.number()),
    sections: v.optional(v.array(sectionValidator)),
  },
  handler: async (ctx, { songId, title, key, countIn, subdivision, bpm, sections }) => {
    const song = await ctx.db.get(songId);
    if (song === null) throw new ConvexError("That Song no longer exists");
    await requireAdmin(ctx, song.groupId);
    if (bpm !== undefined && !validBpm(bpm)) throw new ConvexError("Song tempo must be from 30 to 300 BPM");
    if (subdivision !== undefined && !SUBDIVISIONS.some((n) => n === subdivision)) throw new ConvexError("Clicks per beat must be 1, 2, 3 or 4");
    if (sections !== undefined && sections.length > 64) throw new ConvexError("A Song can have at most 64 Sections");
    const songBpm = bpm ?? song.bpm;
    const stored = song.bpm === undefined ? markOwnTempos(song.sections, commonBpm(song.sections) ?? bpm ?? 0) : song.sections;
    const given = sections ?? (bpm !== undefined ? stored : undefined);
    const shaped = given !== undefined && songBpm !== undefined ? withSongTempo(given, songBpm) : given;
    if (sections !== undefined && shaped !== undefined) {
      const vocabulary = new Set(await groupVocabulary(ctx, song.groupId));
      shaped.forEach((section, index) => checkSection(section, index, vocabulary));
    }
    await ctx.db.patch(songId, {
      ...(title !== undefined ? { title: cleanTitle(title) } : {}),
      ...(key !== undefined ? { key: cleanKey(key) } : {}),
      ...(countIn !== undefined ? { countIn } : {}),
      ...(subdivision !== undefined ? { subdivision } : {}),
      ...(bpm !== undefined ? { bpm } : {}),
      ...(shaped !== undefined ? { sections: shaped } : {}),
    });
  },
});

export const get = query({
  args: { songId: v.id("songs") },
  handler: async (ctx, { songId }) => {
    const song = await ctx.db.get(songId);
    if (song === null) return null;
    await requireMember(ctx, song.groupId);
    return {
      songId: song._id,
      title: song.title,
      key: song.key ?? null,
      tempoHint: song.tempoHint ?? null,
      bpm: song.bpm ?? null,
      countIn: song.countIn,
      subdivision: subdivisionOf(song),
      sections: song.sections,
    };
  },
});

export const deleteSong = mutation({
  args: { songId: v.id("songs") },
  handler: async (ctx, { songId }) => {
    const song = await ctx.db.get(songId);
    if (song === null) return;
    await requireAdmin(ctx, song.groupId);
    const setlists = await ctx.db
      .query("setlists")
      .withIndex("by_group", (q) => q.eq("groupId", song.groupId))
      .collect();
    for (const setlist of setlists) {
      if (setlist.entries.some((entry) => entry.songId === songId)) {
        await ctx.db.patch(setlist._id, {
          entries: setlist.entries.filter((entry) => entry.songId !== songId),
          revision: (setlist.revision ?? 0) + 1,
        });
      }
    }
    const playback = await ctx.db
      .query("playbacks")
      .withIndex("by_group", (q) => q.eq("groupId", song.groupId))
      .unique();
    if (playback?.songId === songId) await ctx.db.delete(playback._id);
    await ctx.db.delete(songId);
  },
});
