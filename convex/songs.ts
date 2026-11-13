import { ConvexError, v } from "convex/values";

import type { Doc } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { requireMember, requireRole, requireRoleInUnlocked, requireLibraryReader } from "./access";
import { logActivity } from "./activity";
import { songChanges } from "../src/activity/changes";
import { touchLibrary } from "./library";
import { requireRoomForSongs } from "./plans";
import { groupVocabulary } from "./vocabulary";
import { wordKey } from "../src/audio/clip-choice";
import { BEAT_UNITS, CUE_LEAD_BARS, MAX_PLAYS, SUBDIVISIONS } from "../src/sync/timeline";
import { songSummary, songView } from "../src/library/song-views";
import { sectionFields } from "./schema";
import { commonBpm, markOwnTempos, withSongTempo } from "../src/sync/song-tempo";
import { byBar, timeChangesProblem } from "../src/sync/time-changes";
import { copyBaseOf, copyTitle, MAX_SONG_TITLE } from "../src/lib/copy-title";

const cleanTitle = (title: string) => {
  const trimmed = title.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_SONG_TITLE) throw new ConvexError(`Song title must be 1 to ${MAX_SONG_TITLE} characters`);
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
    const { group, membership } = await requireRoleInUnlocked(ctx, groupId, "songManager");
    await requireRoomForSongs(ctx, group, 1);
    const cleaned = cleanTitle(title);
    const songId = await ctx.db.insert("songs", { groupId, title: cleaned, key: cleanKey(key), countIn: true, sections: [] });
    await touchLibrary(ctx, groupId);
    await logActivity(ctx, membership, "song", `Added the Song ${cleaned}`);
    return songId;
  },
});

export const list = query({
  args: { groupId: v.id("groups") },
  handler: async (ctx, { groupId }) => {
    await requireLibraryReader(ctx, groupId);
    const songs = await ctx.db
      .query("songs")
      .withIndex("by_group", (q) => q.eq("groupId", groupId))
      .collect();
    return songs.map(songSummary);
  },
});

const sectionValidator = sectionFields;

type Section = Doc<"songs">["sections"][number];

export function songCopyFields(song: Doc<"songs">): Omit<Doc<"songs">, "_id" | "_creationTime" | "groupId" | "title"> {
  return {
    key: song.key,
    tempoHint: song.tempoHint,
    bpm: song.bpm,
    countIn: song.countIn,
    subdivision: song.subdivision,
    cueLeadBars: song.cueLeadBars,
    copyBase: song.copyBase,
    sections: song.sections,
  };
}

const wholeBetween = (value: number, min: number, max: number) => Number.isInteger(value) && value >= min && value <= max;

const validBpm = (bpm: number) => bpm >= 30 && bpm <= 300;

function checkSection(section: Section, index: number, vocabulary: ReadonlyMap<string, string>): Section {
  const where = `Section ${index + 1}`;
  const sectionType = vocabulary.get(wordKey(section.sectionType));
  if (sectionType === undefined) throw new ConvexError(`${where}: Section type is not in the Cue vocabulary`);
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
  if (section.plays !== undefined && !wholeBetween(section.plays, 1, MAX_PLAYS)) {
    throw new ConvexError(`${where}: Plays must be a whole number from 1 to ${MAX_PLAYS}`);
  }
  const timeProblem = timeChangesProblem(section);
  if (timeProblem) throw new ConvexError(`${where}: ${timeProblem}`);
  const { plays, timeChanges, ...rest } = section;
  return {
    ...rest,
    ...(plays !== undefined && plays > 1 ? { plays } : {}),
    ...(timeChanges?.length ? { timeChanges: byBar(timeChanges) } : {}),
    sectionType,
  };
}

export const updateSong = mutation({
  args: {
    songId: v.id("songs"),
    title: v.optional(v.string()),
    key: v.optional(v.string()),
    countIn: v.optional(v.boolean()),
    subdivision: v.optional(v.number()),
    cueLeadBars: v.optional(v.number()),
    bpm: v.optional(v.number()),
    sections: v.optional(v.array(sectionValidator)),
  },
  handler: async (ctx, { songId, title, key, countIn, subdivision, cueLeadBars, bpm, sections }) => {
    const song = await ctx.db.get(songId);
    if (song === null) throw new ConvexError("That Song no longer exists");
    const { membership } = await requireRoleInUnlocked(ctx, song.groupId, "songManager");
    if (bpm !== undefined && !validBpm(bpm)) throw new ConvexError("Song tempo must be from 30 to 300 BPM");
    if (subdivision !== undefined && !SUBDIVISIONS.some((n) => n === subdivision)) throw new ConvexError("Clicks per beat must be 1, 2, 3 or 4");
    if (cueLeadBars !== undefined && !CUE_LEAD_BARS.some((n) => n === cueLeadBars)) throw new ConvexError("Cues can start one or two bars before a Section");
    if (sections !== undefined && sections.length > 64) throw new ConvexError("A Song can have at most 64 Sections");
    const songBpm = bpm ?? song.bpm;
    const stored = song.bpm === undefined ? markOwnTempos(song.sections, commonBpm(song.sections) ?? bpm ?? 0) : song.sections;
    const given = sections ?? (bpm !== undefined ? stored : undefined);
    let shaped = given !== undefined && songBpm !== undefined ? withSongTempo(given, songBpm) : given;
    if (sections !== undefined && shaped !== undefined) {
      const vocabulary = new Map((await groupVocabulary(ctx, song.groupId)).map((word) => [wordKey(word), word]));
      shaped = shaped.map((section, index) => checkSection(section, index, vocabulary));
    }
    const changes = {
      ...(title !== undefined ? { title: cleanTitle(title) } : {}),
      ...(key !== undefined ? { key: cleanKey(key) } : {}),
      ...(countIn !== undefined ? { countIn } : {}),
      ...(subdivision !== undefined ? { subdivision } : {}),
      ...(cueLeadBars !== undefined ? { cueLeadBars } : {}),
      ...(bpm !== undefined ? { bpm } : {}),
      ...(shaped !== undefined ? { sections: shaped } : {}),
    };
    await ctx.db.patch(songId, changes);
    await touchLibrary(ctx, song.groupId);
    const edited = { ...song, ...changes };
    const details = songChanges(song, edited);
    if (details.length > 0) await logActivity(ctx, membership, "song", `Edited ${edited.title}`, details);
  },
});

export const get = query({
  args: { songId: v.id("songs") },
  handler: async (ctx, { songId }) => {
    const song = await ctx.db.get(songId);
    if (song === null) return null;
    await requireMember(ctx, song.groupId);
    return songView(song);
  },
});

export const duplicateSong = mutation({
  args: { songId: v.id("songs") },
  handler: async (ctx, { songId }) => {
    const song = await ctx.db.get(songId);
    if (song === null) throw new ConvexError("That Song no longer exists");
    const { group, membership } = await requireRoleInUnlocked(ctx, song.groupId, "songManager");
    await requireRoomForSongs(ctx, group, 1);
    const library = await ctx.db
      .query("songs")
      .withIndex("by_group", (q) => q.eq("groupId", song.groupId))
      .collect();
    const copyBase = copyBaseOf(song);
    const title = copyTitle(copyBase, library.map((other) => other.title));
    const copyId = await ctx.db.insert("songs", { ...songCopyFields(song), groupId: song.groupId, title, copyBase });
    await touchLibrary(ctx, song.groupId);
    await logActivity(ctx, membership, "song", `Duplicated ${song.title} as ${title}`);
    return { songId: copyId, title };
  },
});

export const copyToGroup = mutation({
  args: { songId: v.id("songs"), toGroupId: v.id("groups") },
  handler: async (ctx, { songId, toGroupId }) => {
    const song = await ctx.db.get(songId);
    if (song === null) throw new ConvexError("That Song no longer exists");
    if (song.groupId === toGroupId) throw new ConvexError("That Song is already in this Group; duplicate it instead");
    const { membership: fromMembership } = await requireRole(ctx, song.groupId, "songManager");
    const { group, membership } = await requireRoleInUnlocked(ctx, toGroupId, "songManager");
    await requireRoomForSongs(ctx, group, 1);
    const library = await ctx.db
      .query("songs")
      .withIndex("by_group", (q) => q.eq("groupId", toGroupId))
      .collect();
    const titles = library.map((other) => other.title);
    const title = titles.includes(song.title) ? copyTitle(copyBaseOf(song), titles) : song.title;
    const copyId = await ctx.db.insert("songs", { ...songCopyFields(song), groupId: toGroupId, title });
    await touchLibrary(ctx, toGroupId);
    const fromGroup = await ctx.db.get(song.groupId);
    await logActivity(ctx, fromMembership, "song", `Copied ${song.title} to ${group.name}`);
    await logActivity(ctx, membership, "song", fromGroup?.offline === true ? `Copied ${title} from My Library` : `Copied ${title} from ${fromGroup?.name ?? "another Group"}`);
    return { songId: copyId, title, groupName: group.name };
  },
});

export const deleteSong = mutation({
  args: { songId: v.id("songs") },
  handler: async (ctx, { songId }) => {
    const song = await ctx.db.get(songId);
    if (song === null) return;
    const { membership } = await requireRoleInUnlocked(ctx, song.groupId, "songManager");
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
    await touchLibrary(ctx, song.groupId);
    await logActivity(ctx, membership, "song", `Deleted the Song ${song.title}`);
  },
});
