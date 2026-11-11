import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";

import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
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
    requestedAt: v.number(),
    entitled: v.union(v.object({ plan: paidPlanValidator, expiresAt: v.union(v.number(), v.null()), store: v.optional(v.string()) }), v.null()),
  },
  handler: async (ctx, { userId, requestedAt, entitled }) => {
    if ((await ctx.db.get(userId)) === null) return "unknown user";
    const existing = await ctx.db
      .query("subscriptions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    if (existing && existing.syncedAt > requestedAt) return "older than saved";
    const row = { userId, plan: entitled?.plan ?? null, expiresAt: entitled?.expiresAt ?? null, store: entitled?.store, syncedAt: requestedAt };
    if (existing) await ctx.db.replace(existing._id, row);
    else await ctx.db.insert("subscriptions", row);
    return "saved";
  },
});

async function syncUser(ctx: ActionCtx, userId: Id<"users">) {
  const secret = process.env.REVENUECAT_SECRET_API_KEY;
  if (!secret) throw new ConvexError("Subscriptions are not set up on this deployment");
  const requestedAt = Date.now();
  const response = await fetch(`${REVENUECAT_SUBSCRIBERS_URL}${encodeURIComponent(userId)}`, {
    headers: { Authorization: `Bearer ${secret}`, Accept: "application/json" },
  });
  if (!response.ok) throw new ConvexError(`RevenueCat answered ${response.status}`);
  const body = (await response.json()) as { subscriber?: RevenueCatSubscriber };
  const entitled = entitledPlan(body.subscriber ?? {}, Date.now());
  await ctx.runMutation(internal.subscriptions.store, { userId, requestedAt, entitled });
  return entitled;
}

export const refreshMine = action({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new ConvexError("Sign in first");
    return (await syncUser(ctx, userId))?.plan ?? "free";
  },
});

const RECHECK_BEFORE_MS = 2 * 60 * 60_000;
const RECHECK_AFTER_MS = 3 * 24 * 60 * 60_000;
const RECHECK_BATCH = 100;

export const expiringSoon = internalQuery({
  args: { nowMs: v.number(), cursor: v.union(v.string(), v.null()) },
  handler: async (ctx, { nowMs, cursor }) => {
    const page = await ctx.db
      .query("subscriptions")
      .withIndex("by_expires", (q) => q.gte("expiresAt", nowMs - RECHECK_AFTER_MS).lte("expiresAt", nowMs + RECHECK_BEFORE_MS))
      .paginate({ cursor, numItems: RECHECK_BATCH });
    return { userIds: page.page.filter((row) => row.plan !== null).map((row) => row.userId), cursor: page.continueCursor, isDone: page.isDone };
  },
});

export const recheckExpiring = internalAction({
  args: {},
  handler: async (ctx) => {
    const nowMs = Date.now();
    let cursor: string | null = null;
    let checked = 0;
    for (;;) {
      const page: { userIds: Id<"users">[]; cursor: string; isDone: boolean } = await ctx.runQuery(internal.subscriptions.expiringSoon, { nowMs, cursor });
      for (const userId of page.userIds) await syncUser(ctx, userId).catch(() => undefined);
      checked += page.userIds.length;
      if (page.isDone) return checked;
      cursor = page.cursor;
    }
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
  try {
    for (const appUserId of appUserIds) {
      const userId = await ctx.runQuery(internal.subscriptions.userIdFor, { appUserId });
      if (userId !== null) await syncUser(ctx, userId);
    }
  } catch {
    return new Response("Could not reach RevenueCat; retry later", { status: 500 });
  }
  return new Response(null, { status: 200 });
});
