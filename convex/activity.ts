import { paginationOptsValidator } from "convex/server";
import { v, type Infer } from "convex/values";

import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { internalMutation, query, type MutationCtx } from "./_generated/server";
import { requireRole } from "./access";
import { activityKindValidator } from "./schema";
import { capDetails } from "../src/activity/changes";

export type ActivityKind = Infer<typeof activityKindValidator>;

export type Actor = Pick<Doc<"memberships">, "groupId" | "userId" | "displayName">;

const FORGET_BATCH = 500;

export async function logActivity(ctx: MutationCtx, actor: Actor, kind: ActivityKind, summary: string, details: readonly string[] = []) {
  const group = await ctx.db.get(actor.groupId);
  if (group === null || group.offline === true) return;
  await ctx.db.insert("activity", {
    groupId: actor.groupId,
    actorId: actor.userId,
    actorName: actor.displayName,
    kind,
    summary,
    ...(details.length > 0 ? { details: capDetails(details) } : {}),
  });
}

export const list = query({
  args: { groupId: v.id("groups"), kind: v.optional(activityKindValidator), paginationOpts: paginationOptsValidator },
  handler: async (ctx, { groupId, kind, paginationOpts }) => {
    await requireRole(ctx, groupId, "playbackManager");
    const result =
      kind === undefined
        ? await ctx.db
            .query("activity")
            .withIndex("by_group", (q) => q.eq("groupId", groupId))
            .order("desc")
            .paginate(paginationOpts)
        : await ctx.db
            .query("activity")
            .withIndex("by_group_kind", (q) => q.eq("groupId", groupId).eq("kind", kind))
            .order("desc")
            .paginate(paginationOpts);
    return {
      ...result,
      page: result.page.map((row) => ({
        activityId: row._id,
        at: row._creationTime,
        actorName: row.actorName,
        kind: row.kind,
        summary: row.summary,
        details: row.details ?? [],
      })),
    };
  },
});

export const forgetGroup = internalMutation({
  args: { groupId: v.id("groups") },
  handler: async (ctx, { groupId }) => {
    const rows = await ctx.db
      .query("activity")
      .withIndex("by_group", (q) => q.eq("groupId", groupId))
      .take(FORGET_BATCH);
    await Promise.all(rows.map((row) => ctx.db.delete(row._id)));
    if (rows.length === FORGET_BATCH) await ctx.scheduler.runAfter(0, internal.activity.forgetGroup, { groupId });
  },
});
