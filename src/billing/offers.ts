import type { PaidPlan } from "@/lib/plans";

export type Billing = "monthly" | "annual";

type PackageLike = { identifier: string; product: { priceString: string } };

export type PlanOffer<P extends PackageLike = PackageLike> = { plan: PaidPlan; billing: Billing; price: string; pkg: P };

const PLAN_OFFERINGS: readonly PaidPlan[] = ["plus", "pro"];

export function offersFrom<P extends PackageLike>(offerings: { all: Record<string, { monthly: P | null; annual: P | null } | undefined> }): PlanOffer<P>[] {
  return PLAN_OFFERINGS.flatMap((plan) => {
    const offering = offerings.all[plan];
    if (offering === undefined) return [];
    const billed: [Billing, P | null][] = [
      ["monthly", offering.monthly],
      ["annual", offering.annual],
    ];
    return billed.flatMap(([billing, pkg]) => (pkg === null ? [] : [{ plan, billing, price: pkg.product.priceString, pkg }]));
  });
}
