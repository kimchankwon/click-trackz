import { paginationOptsValidator } from "convex/server";
import { ConvexError, v } from "convex/values";

import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, mutation, query, type MutationCtx } from "./_generated/server";
import { requireMember } from "./access";
import { logActivity } from "./activity";
import { cleanComment, COMMENT_GAP_MS, isReaction, MAX_COMMENT_LENGTH, REACTION_GAP_MS } from "../src/lib/chat";

const RECENT_REACTIONS = 20;
const KEEP_REACTIONS_MS = 10 * 60_000;
const FORGET_BATCH = 500;

async function requireGroupChat(ctx: MutationCtx, groupId: Id<"groups">) {
  const access = await requireMember(ctx, groupId);
  const group = await ctx.db.get(groupId);
  if (group === null || group.offline === true) throw new ConvexError("Comments and Reactions are for a Group, not My Library");
  return access;
}

async function requireGap(ctx: MutationCtx, groupId: Id<"groups">, userId: Id<"users">, kind: Doc<"chat">["kind"], gapMs: number) {
  const last = await ctx.db
    .query("chat")
    .withIndex("by_group_user_kind", (q) => q.eq("groupId", groupId).eq("userId", userId).eq("kind", kind))
    .order("desc")
    .first();
  if (last !== null && Date.now() - last._creationTime < gapMs) throw new ConvexError("Slow down a little");
}

const shown = (row: Doc<"chat">) => ({ chatId: row._id, userId: row.userId, name: row.displayName, text: row.text, at: row._creationTime });

export const comment = mutation({
  args: { groupId: v.id("groups"), text: v.string() },
  handler: async (ctx, { groupId, text }) => {
    const cleaned = cleanComment(text);
    if (cleaned.length === 0) throw new ConvexError("Write something first");
    if (cleaned.length > MAX_COMMENT_LENGTH) throw new ConvexError(`A Comment can be up to ${MAX_COMMENT_LENGTH} characters`);
    const { user, membership } = await requireGroupChat(ctx, groupId);
    await requireGap(ctx, groupId, user._id, "comment", COMMENT_GAP_MS);
    await ctx.db.insert("chat", { groupId, userId: user._id, displayName: membership.displayName, kind: "comment", text: cleaned });
    await logActivity(ctx, membership, "comment", `Said "${cleaned}"`);
  },
});

export const react = mutation({
  args: { groupId: v.id("groups"), reaction: v.string() },
  handler: async (ctx, { groupId, reaction }) => {
    if (!isReaction(reaction)) throw new ConvexError("That Reaction is not offered");
    const { user, membership } = await requireGroupChat(ctx, groupId);
    await requireGap(ctx, groupId, user._id, "reaction", REACTION_GAP_MS);
    await ctx.db.insert("chat", { groupId, userId: user._id, displayName: membership.displayName, kind: "reaction", text: reaction });
  },
});

export const comments = query({
  args: { groupId: v.id("groups"), paginationOpts: paginationOptsValidator },
  handler: async (ctx, { groupId, paginationOpts }) => {
    await requireMember(ctx, groupId);
    const result = await ctx.db
      .query("chat")
      .withIndex("by_group_kind", (q) => q.eq("groupId", groupId).eq("kind", "comment"))
      .order("desc")
      .paginate(paginationOpts);
    return { ...result, page: result.page.map(shown) };
  },
});

export const reactions = query({
  args: { groupId: v.id("groups") },
  handler: async (ctx, { groupId }) => {
    await requireMember(ctx, groupId);
    const rows = await ctx.db
      .query("chat")
      .withIndex("by_group_kind", (q) => q.eq("groupId", groupId).eq("kind", "reaction"))
      .order("desc")
      .take(RECENT_REACTIONS);
    return rows.map(shown);
  },
});

export const forgetOldReactions = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - KEEP_REACTIONS_MS;
    const old = await ctx.db
      .query("chat")
      .withIndex("by_kind", (q) => q.eq("kind", "reaction").lt("_creationTime", cutoff))
      .take(FORGET_BATCH);
    await Promise.all(old.map((row) => ctx.db.delete(row._id)));
    if (old.length === FORGET_BATCH) await ctx.scheduler.runAfter(0, internal.chat.forgetOldReactions, {});
  },
});

export const forgetGroup = internalMutation({
  args: { groupId: v.id("groups") },
  handler: async (ctx, { groupId }) => {
    const rows = await Promise.all(
      (["comment", "reaction"] as const).map((kind) =>
        ctx.db
          .query("chat")
          .withIndex("by_group_kind", (q) => q.eq("groupId", groupId).eq("kind", kind))
          .take(FORGET_BATCH),
      ),
    );
    await Promise.all(rows.flat().map((row) => ctx.db.delete(row._id)));
    if (rows.some((batch) => batch.length === FORGET_BATCH)) await ctx.scheduler.runAfter(0, internal.chat.forgetGroup, { groupId });
  },
});
