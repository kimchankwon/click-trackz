import { describe, expect, it } from "vitest";

import { timeAgo } from "./time-ago";

describe("timeAgo", () => {
  it("says roughly how long ago, in the largest whole unit", () => {
    expect(timeAgo(20_000)).toBe("just now");
    expect(timeAgo(5 * 60_000)).toBe("5 min ago");
    expect(timeAgo(3 * 3_600_000 + 1)).toBe("3 h ago");
    expect(timeAgo(24 * 3_600_000)).toBe("1 day ago");
    expect(timeAgo(3 * 24 * 3_600_000)).toBe("3 days ago");
    expect(timeAgo(15 * 24 * 3_600_000)).toBe("2 weeks ago");
  });
});
