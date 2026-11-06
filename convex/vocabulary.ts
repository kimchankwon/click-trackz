import { v } from "convex/values";

import { wordKey } from "../src/audio/clip-choice";
import { builtinSectionTypes } from "../src/sync/cue-vocabulary";
import type { Id } from "./_generated/dataModel";
import { query, type QueryCtx } from "./_generated/server";
import { requireMember } from "./access";

export async function groupVocabulary(ctx: QueryCtx, groupId: Id<"groups">): Promise<string[]> {
  const songs = await ctx.db
    .query("songs")
    .withIndex("by_group", (q) => q.eq("groupId", groupId))
    .collect();
  const known = new Set(builtinSectionTypes.map(wordKey));
  const kept: string[] = [];
  for (const word of songs.flatMap((song) => song.sections.map((s) => s.sectionType))) {
    if (known.has(wordKey(word))) continue;
    known.add(wordKey(word));
    kept.push(word);
  }
  return [...builtinSectionTypes, ...kept];
}

export const list = query({
  args: { groupId: v.id("groups") },
  handler: async (ctx, { groupId }) => {
    await requireMember(ctx, groupId);
    return groupVocabulary(ctx, groupId);
  },
});
