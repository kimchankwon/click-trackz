import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";

import { internal } from "./_generated/api";
import { action, httpAction, internalAction, internalMutation, internalQuery, query, type ActionCtx } from "./_generated/server";
import { requireUser } from "./access";
import { secretsMatch } from "./devLogin";
import { usageOf } from "./plans";
import { appUserIdsOf, entitledPlan, type RevenueCatSubscriber } from "./revenuecat";
import { paidPlanValidator } from "./schema";

const REVENUECAT_SUBSCRIBERS_URL = "https://api.revenuecat.com/v1/subscribers/";

export const mine = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    return usageOf(ctx, user._id);
  },
});

export const store = internalMutation({
  args: {
    userId: v.id("users"),
    entitled: v.union(v.object({ plan: paidPlanValidator, expiresAt: v.union(v.number(), v.null()), store: v.optional(v.string()) }), v.null()),
  },
  handler: async (ctx, { userId, entitled }) => {
    if ((await ctx.db.get(userId)) === null) return;
    const existing = await ctx.db
      .query("subscriptions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    if (entitled === null) {
      if (existing) await ctx.db.delete(existing._id);
      return;
    }
    const row = { userId, plan: entitled.plan, expiresAt: entitled.expiresAt, store: entitled.store, syncedAt: Date.now() };
    if (existing) await ctx.db.replace(existing._id, row);
    else await ctx.db.insert("subscriptions", row);
  },
});

async function syncFromRevenueCat(ctx: ActionCtx, userId: string) {
  const secret = process.env.REVENUECAT_SECRET_API_KEY;
  if (!secret) throw new ConvexError("Subscriptions are not set up on this deployment");
  const response = await fetch(`${REVENUECAT_SUBSCRIBERS_URL}${encodeURIComponent(userId)}`, {
    headers: { Authorization: `Bearer ${secret}`, Accept: "application/json" },
  });
  if (!response.ok) throw new ConvexError(`RevenueCat answered ${response.status}`);
  const body = (await response.json()) as { subscriber?: RevenueCatSubscriber };
  return entitledPlan(body.subscriber ?? {}, Date.now());
}

export const sync = internalAction({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const entitled = await syncFromRevenueCat(ctx, userId);
    await ctx.runMutation(internal.subscriptions.store, { userId, entitled });
  },
});

export const refreshMine = action({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new ConvexError("Sign in first");
    const entitled = await syncFromRevenueCat(ctx, userId);
    await ctx.runMutation(internal.subscriptions.store, { userId, entitled });
    return entitled?.plan ?? "free";
  },
});

export const userIdFor = internalQuery({
  args: { appUserId: v.string() },
  handler: async (ctx, { appUserId }) => {
    const userId = ctx.db.normalizeId("users", appUserId);
    return userId !== null && (await ctx.db.get(userId)) !== null ? userId : null;
  },
});

export const revenueCatWebhook = httpAction(async (ctx, request) => {
  const expected = process.env.REVENUECAT_WEBHOOK_AUTH;
  const given = request.headers.get("Authorization") ?? "";
  if (!expected || !secretsMatch(given, expected)) return new Response("Unauthorized", { status: 401 });
  const appUserIds = appUserIdsOf(await request.json().catch(() => null));
  for (const appUserId of appUserIds) {
    const userId = await ctx.runQuery(internal.subscriptions.userIdFor, { appUserId });
    if (userId !== null) await ctx.scheduler.runAfter(0, internal.subscriptions.sync, { userId });
  }
  return new Response(null, { status: 200 });
});
