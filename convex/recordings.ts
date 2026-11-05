import { v } from "convex/values";

import { wordKey } from "../src/audio/clip-choice";
import { builtinSectionTypes } from "../src/sync/cue-vocabulary";
import type { Id } from "./_generated/dataModel";
import { mutation, query, type QueryCtx } from "./_generated/server";
import { requireAdmin, requireMember } from "./access";

const MAX_BYTES = 1_000_000;

export async function groupVocabulary(ctx: QueryCtx, groupId: Id<"groups">): Promise<string[]> {
  const recordings = await ctx.db
    .query("recordings")
    .withIndex("by_group", (q) => q.eq("groupId", groupId))
    .collect();
  const songs = await ctx.db
    .query("songs")
    .withIndex("by_group", (q) => q.eq("groupId", groupId))
    .collect();
  const known = new Set(builtinSectionTypes.map(wordKey));
  const added: string[] = [];
  for (const word of [...recordings.map((r) => r.word), ...songs.flatMap((song) => song.sections.map((s) => s.sectionType))]) {
    if (known.has(wordKey(word))) continue;
    known.add(wordKey(word));
    added.push(word);
  }
  return [...builtinSectionTypes, ...added];
}

const cleanWord = (word: string) => {
  const trimmed = word.trim().replace(/\s+/g, " ");
  return /^[A-Za-z][A-Za-z -]{0,19}$/.test(trimmed) ? trimmed : null;
};

export const generateUploadUrl = mutation({
  args: { groupId: v.id("groups") },
  handler: async (ctx, { groupId }) => {
    await requireAdmin(ctx, groupId);
    return ctx.storage.generateUploadUrl();
  },
});

export const save = mutation({
  args: {
    groupId: v.id("groups"),
    word: v.string(),
    number: v.optional(v.number()),
    storageId: v.id("_storage"),
  },
  handler: async (ctx, { groupId, word, number, storageId }) => {
    await requireAdmin(ctx, groupId);
    const discard = async (error: string) => {
      await ctx.storage.delete(storageId);
      return { ok: false as const, error };
    };
    const file = await ctx.db.system.get(storageId);
    if (file === null) return { ok: false as const, error: "Upload the recording first" };
    const claimed = await ctx.db
      .query("recordings")
      .withIndex("by_storage", (q) => q.eq("storageId", storageId))
      .first();
    if (claimed) return { ok: false as const, error: "That upload is already used by a recording. Choose the file again." };
    if (file.size > MAX_BYTES) return discard("Recordings must be under 1 MB");
    if (!file.contentType?.startsWith("audio/")) return discard("Recordings must be audio files");
    if (number !== undefined && !(Number.isInteger(number) && number >= 1 && number <= 9)) return discard("Number must be 1 to 9");
    const cleaned = cleanWord(word);
    if (cleaned === null) return discard("A word must be 1 to 20 letters, spaces or hyphens");
    const key = number === undefined ? wordKey(cleaned) : `${wordKey(cleaned)}-${number}`;
    const existing = await ctx.db
      .query("recordings")
      .withIndex("by_group_key", (q) => q.eq("groupId", groupId).eq("key", key))
      .unique();
    if (existing) {
      await ctx.storage.delete(existing.storageId);
      await ctx.db.patch(existing._id, { word: cleaned, number, storageId });
    } else {
      await ctx.db.insert("recordings", { groupId, key, word: cleaned, number, storageId });
    }
    return { ok: true as const, key };
  },
});

export const list = query({
  args: { groupId: v.id("groups") },
  handler: async (ctx, { groupId }) => {
    await requireMember(ctx, groupId);
    const recordings = await ctx.db
      .query("recordings")
      .withIndex("by_group", (q) => q.eq("groupId", groupId))
      .collect();
    return Promise.all(
      recordings.map(async (recording) => ({
        key: recording.key,
        word: recording.word,
        number: recording.number ?? null,
        url: await ctx.storage.getUrl(recording.storageId),
      })),
    );
  },
});

export const remove = mutation({
  args: { groupId: v.id("groups"), key: v.string() },
  handler: async (ctx, { groupId, key }) => {
    await requireAdmin(ctx, groupId);
    const recording = await ctx.db
      .query("recordings")
      .withIndex("by_group_key", (q) => q.eq("groupId", groupId).eq("key", key))
      .unique();
    if (recording === null) return;
    await ctx.storage.delete(recording.storageId);
    await ctx.db.delete(recording._id);
  },
});

export const vocabulary = query({
  args: { groupId: v.id("groups") },
  handler: async (ctx, { groupId }) => {
    await requireMember(ctx, groupId);
    return groupVocabulary(ctx, groupId);
  },
});
