import { describe, expect, it } from "vitest";

import { appUserIdsOf, entitledPlan } from "./revenuecat";

const NOW = Date.parse("2026-11-11T00:00:00Z");

describe("entitledPlan", () => {
  it("prefers an active Pro entitlement over Plus", () => {
    expect(
      entitledPlan(
        {
          entitlements: {
            plus: { expires_date: "2026-12-01T00:00:00Z", product_identifier: "plus_monthly" },
            pro: { expires_date: "2026-12-05T00:00:00Z", product_identifier: "pro_yearly" },
          },
          subscriptions: { pro_yearly: { store: "app_store" } },
        },
        NOW,
      ),
    ).toEqual({ plan: "pro", expiresAt: Date.parse("2026-12-05T00:00:00Z"), store: "app_store" });
  });

  it("falls back to Plus when Pro has expired", () => {
    expect(
      entitledPlan(
        {
          entitlements: {
            plus: { expires_date: null, product_identifier: "plus_lifetime" },
            pro: { expires_date: "2026-11-01T00:00:00Z" },
          },
        },
        NOW,
      ),
    ).toEqual({ plan: "plus", expiresAt: null, store: undefined });
  });

  it("keeps a plan through its billing grace period", () => {
    expect(entitledPlan({ entitlements: { plus: { expires_date: "2026-11-01T00:00:00Z", grace_period_expires_date: "2026-11-20T00:00:00Z" } } }, NOW)).toMatchObject({
      plan: "plus",
      expiresAt: Date.parse("2026-11-20T00:00:00Z"),
    });
  });

  it("gives nothing when no entitlement is active", () => {
    expect(entitledPlan({}, NOW)).toBeNull();
    expect(entitledPlan({ entitlements: { plus: { expires_date: "2026-11-10T00:00:00Z" } } }, NOW)).toBeNull();
  });
});

describe("appUserIdsOf", () => {
  it("collects every app user id a webhook event names, skipping anonymous RevenueCat ids", () => {
    expect(
      appUserIdsOf({
        event: { app_user_id: "user1", original_app_user_id: "$RCAnonymousID:abc", aliases: ["user1", "user2"], transferred_to: ["user3"] },
      }),
    ).toEqual(["user1", "user2", "user3"]);
  });

  it("ignores bodies that are not webhook events", () => {
    expect(appUserIdsOf(null)).toEqual([]);
    expect(appUserIdsOf({ event: "nope" })).toEqual([]);
  });
});
