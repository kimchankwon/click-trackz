export const PLANS_LOW_TO_HIGH = ["free", "plus", "pro"] as const;

export type Plan = (typeof PLANS_LOW_TO_HIGH)[number];

export type PaidPlan = Exclude<Plan, "free">;

export type PlanLimits = { groups: number | null; songs: number | null; librarySongs: number };

const LIMITS: Record<Plan, PlanLimits> = {
  free: { groups: 0, songs: 0, librarySongs: 10 },
  plus: { groups: 3, songs: 100, librarySongs: 1000 },
  pro: { groups: null, songs: null, librarySongs: 1000 },
};

export const PLAN_NAMES: Record<Plan, string> = { free: "Free", plus: "Plus", pro: "Pro" };

export const planLimits = (plan: Plan): PlanLimits => LIMITS[plan];

export const betterPlan = (a: Plan, b: Plan): Plan => (PLANS_LOW_TO_HIGH.indexOf(a) >= PLANS_LOW_TO_HIGH.indexOf(b) ? a : b);

const within = (limit: number | null, count: number) => limit === null || count <= limit;

export const canCreateGroup = (plan: Plan, ownedGroups: number) => within(planLimits(plan).groups, ownedGroups + 1);

export const canAddSongs = (plan: Plan, ownedSongs: number, adding: number) => within(planLimits(plan).songs, ownedSongs + adding);

export const canAddLibrarySongs = (plan: Plan, librarySongs: number, adding: number) => librarySongs + adding <= planLimits(plan).librarySongs;

export const isGroupLocked = (plan: Plan, oldestFirstIndex: number) => !within(planLimits(plan).groups, oldestFirstIndex + 1);

export const isPaidPlan = (value: unknown): value is PaidPlan => value === "plus" || value === "pro";
