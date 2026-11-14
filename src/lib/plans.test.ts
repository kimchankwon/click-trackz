import { describe, expect, it } from "vitest";

import { betterPlan, canAddLibrarySongs, canAddSongs, canAddSongsBeforeLaunch, canCreateGroup, canCreateGroupBeforeLaunch, isGroupLocked, planLimits, usageSummary } from "./plans";

describe("plans", () => {
  it("gives Free no Groups of its own, Plus 3 Groups and 100 Songs, and Pro no limits on Groups", () => {
    expect(planLimits("free")).toEqual({ groups: 0, songs: 0, librarySongs: 10 });
    expect(planLimits("plus")).toEqual({ groups: 3, songs: 100, librarySongs: 1000 });
    expect(planLimits("pro")).toEqual({ groups: null, songs: null, librarySongs: 1000 });
  });

  it("lets My Library hold 10 Songs on Free and 1000 on any paid plan", () => {
    expect(canAddLibrarySongs("free", 9, 1)).toBe(true);
    expect(canAddLibrarySongs("free", 10, 1)).toBe(false);
    expect(canAddLibrarySongs("plus", 999, 1)).toBe(true);
    expect(canAddLibrarySongs("pro", 1000, 1)).toBe(false);
  });

  it("picks the better of two plans", () => {
    expect(betterPlan("free", "plus")).toBe("plus");
    expect(betterPlan("pro", "plus")).toBe("pro");
    expect(betterPlan("free", "free")).toBe("free");
  });

  it("allows a new Group only below the plan's Group limit", () => {
    expect(canCreateGroup("free", 0)).toBe(false);
    expect(canCreateGroup("plus", 2)).toBe(true);
    expect(canCreateGroup("plus", 3)).toBe(false);
    expect(canCreateGroup("pro", 500)).toBe(true);
  });

  it("allows new Songs only while the total stays within the plan's Song limit", () => {
    expect(canAddSongs("plus", 99, 1)).toBe(true);
    expect(canAddSongs("plus", 99, 2)).toBe(false);
    expect(canAddSongs("plus", 100, 1)).toBe(false);
    expect(canAddSongs("free", 0, 1)).toBe(false);
    expect(canAddSongs("pro", 10_000, 50)).toBe(true);
  });

  it("locks every Group past the plan's limit, keeping the oldest open", () => {
    expect(isGroupLocked("plus", 0)).toBe(false);
    expect(isGroupLocked("plus", 2)).toBe(false);
    expect(isGroupLocked("plus", 3)).toBe(true);
    expect(isGroupLocked("free", 0)).toBe(true);
    expect(isGroupLocked("pro", 40)).toBe(false);
  });

  it("sums up usage against the plan's limits, or as plain counts when limits are off or unlimited", () => {
    const usage = { groups: 1, songs: 1, librarySongs: 2, limits: planLimits("plus"), enforced: true };
    expect(usageSummary(usage)).toBe("1 of 3 Groups · 1 of 100 Group Songs · 2 of 1000 My Library Songs");
    expect(usageSummary({ ...usage, enforced: false, limits: planLimits("free") })).toBe("1 of 5 Groups · 1 Group Song · 2 My Library Songs");
    expect(usageSummary({ ...usage, groups: 0, limits: planLimits("pro") })).toBe("0 Groups · 1 Group Song · 2 of 1000 My Library Songs");
  });
});

describe("before Plans are charged", () => {
  it("lets everyone create up to 5 Groups", () => {
    expect(canCreateGroupBeforeLaunch(4)).toBe(true);
    expect(canCreateGroupBeforeLaunch(5)).toBe(false);
  });

  it("lets each Group hold up to 100 Songs", () => {
    expect(canAddSongsBeforeLaunch(99, 1)).toBe(true);
    expect(canAddSongsBeforeLaunch(100, 1)).toBe(false);
    expect(canAddSongsBeforeLaunch(0, 101)).toBe(false);
  });
});
