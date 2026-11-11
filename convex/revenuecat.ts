import type { PaidPlan } from "../src/lib/plans";

export type RevenueCatEntitlement = {
  expires_date?: string | null;
  grace_period_expires_date?: string | null;
  product_identifier?: string;
};

export type RevenueCatSubscriber = {
  entitlements?: Record<string, RevenueCatEntitlement>;
  subscriptions?: Record<string, { store?: string }>;
};

export type EntitledPlan = { plan: PaidPlan; expiresAt: number | null; store: string | undefined };

const ENTITLEMENT_PLANS: readonly PaidPlan[] = ["pro", "plus"];

const timeOf = (value: string | null | undefined) => (value ? Date.parse(value) : null);

function expiryOf(entitlement: RevenueCatEntitlement): number | null {
  const expires = timeOf(entitlement.expires_date);
  const grace = timeOf(entitlement.grace_period_expires_date);
  if (expires === null) return null;
  return grace !== null && Number.isFinite(grace) ? Math.max(expires, grace) : expires;
}

export function entitledPlan(subscriber: RevenueCatSubscriber, nowMs: number): EntitledPlan | null {
  for (const plan of ENTITLEMENT_PLANS) {
    const entitlement = subscriber.entitlements?.[plan];
    if (entitlement === undefined) continue;
    const expiresAt = expiryOf(entitlement);
    if (expiresAt !== null && !(expiresAt > nowMs)) continue;
    const product = entitlement.product_identifier;
    return { plan, expiresAt, store: product ? subscriber.subscriptions?.[product]?.store : undefined };
  }
  return null;
}

export function appUserIdsOf(body: unknown): string[] {
  if (typeof body !== "object" || body === null) return [];
  const event = (body as { event?: unknown }).event;
  if (typeof event !== "object" || event === null) return [];
  const { app_user_id, original_app_user_id, aliases, transferred_from, transferred_to } = event as Record<string, unknown>;
  const ids = [app_user_id, original_app_user_id, ...(Array.isArray(aliases) ? aliases : []), ...(Array.isArray(transferred_from) ? transferred_from : []), ...(Array.isArray(transferred_to) ? transferred_to : [])];
  return [...new Set(ids.filter((id): id is string => typeof id === "string" && id.length > 0 && !id.startsWith("$RCAnonymousID:")))];
}
