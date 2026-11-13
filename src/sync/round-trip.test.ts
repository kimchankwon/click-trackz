import { describe, expect, it } from "vitest";

import { bestOf, keepRecent } from "./round-trip";

describe("keepRecent", () => {
  it("keeps only the newest round trips", () => {
    expect(keepRecent([40, 50, 60], 70)).toEqual([50, 60, 70]);
  });

  it("drops a round trip measured backwards", () => {
    expect(keepRecent([40], -5)).toEqual([40]);
  });
});

describe("bestOf", () => {
  it("shows the fastest recent round trip, since slow ones are queueing rather than distance", () => {
    expect(bestOf([90, 42, 61])).toBe(42);
  });

  it("has nothing before the first ping", () => {
    expect(bestOf([])).toBeNull();
  });
});
