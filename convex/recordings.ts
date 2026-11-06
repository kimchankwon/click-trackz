import { v } from "convex/values";

import { query } from "./_generated/server";
import { requireMember } from "./access";
import { groupVocabulary } from "./vocabulary";

export const list = query({
  args: { groupId: v.id("groups") },
  handler: async (ctx, { groupId }) => {
    await requireMember(ctx, groupId);
    return [] as { key: string; word: string; number?: number; url: string | null }[];
  },
});

export const vocabulary = query({
  args: { groupId: v.id("groups") },
  handler: async (ctx, { groupId }) => {
    await requireMember(ctx, groupId);
    return groupVocabulary(ctx, groupId);
  },
});
