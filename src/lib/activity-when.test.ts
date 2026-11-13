import { describe, expect, it } from "vitest";

import { activityWhen } from "./activity-when";

const NOW = Date.UTC(2026, 10, 13, 6, 0);

describe("activityWhen", () => {
  it("says how long ago for the last day", () => {
    expect(activityWhen(NOW - 5 * 60_000, NOW)).toBe("5 min ago");
    expect(activityWhen(NOW + 1_000, NOW)).toBe("just now");
  });

  it("gives the date and time after that, and the year once it is a different one", () => {
    expect(activityWhen(Date.UTC(2026, 10, 10, 9, 5), NOW, "en-AU", "UTC")).toBe("10 Nov, 9:05 am");
    expect(activityWhen(Date.UTC(2025, 11, 24, 21, 30), NOW, "en-AU", "UTC")).toBe("24 Dec 2025, 9:30 pm");
  });
});
