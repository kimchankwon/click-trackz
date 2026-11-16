/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { api, internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const NOW = 1_000_000_000;
const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  vi.stubEnv("PLANS_ENFORCED", "true");
  vi.stubEnv("REVENUECAT_SECRET_API_KEY", "sk_test");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("Hourly re-check of Plans that expired in the last three days", () => {
  it("picks up a renewal that lands after the expiry when its webhook was lost", async () => {
    const t = convexTest(schema, modules);
    const expiresAt = NOW + 30 * MINUTE;
    const userId = await t.run(async (ctx) => {
      const id = await ctx.db.insert("users", { email: "admin@example.com" });
      await ctx.db.insert("subscriptions", { userId: id, plan: "plus", expiresAt, syncedAt: 0 });
      return id;
    });
    const admin = t.withIdentity({ subject: `${userId}|session` });
    let revenueCatExpiry = expiresAt;
    const fetchMock = vi.fn(
      async () => new Response(JSON.stringify({ subscriber: { entitlements: { plus: { expires_date: new Date(revenueCatExpiry).toISOString() } } } }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    vi.setSystemTime(expiresAt + 15 * MINUTE);
    expect(await t.action(internal.subscriptions.recheckExpiring, {})).toBe(1);
    expect(await admin.query(api.subscriptions.mine, {})).toMatchObject({ plan: "free" });

    revenueCatExpiry = expiresAt + 30 * DAY;
    vi.setSystemTime(expiresAt + 75 * MINUTE);
    await t.action(internal.subscriptions.recheckExpiring, {});

    expect(await admin.query(api.subscriptions.mine, {})).toMatchObject({ plan: "plus" });
  });
});

describe("Refreshing my Plan", () => {
  it("does not read RevenueCat for a guest, whose Plan is always Free", async () => {
    const t = convexTest(schema, modules);
    const guestId = await t.run((ctx) => ctx.db.insert("users", { isAnonymous: true }));
    const guest = t.withIdentity({ subject: `${guestId}|session` });
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ subscriber: { entitlements: { pro: { expires_date: null } } } }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    for (let call = 0; call < 5; call++) expect(await guest.action(api.subscriptions.refreshMine, {})).toBe("free");

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
