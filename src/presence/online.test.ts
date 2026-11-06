import { describe, expect, it } from "vitest";

import { countOnPlay, presenceOf, ONLINE_WITHIN_MS } from "./online";

const NOW = 1_000_000;
const rows = [
  { userId: "a", onPlay: true, seenAt: NOW - 1_000 },
  { userId: "b", onPlay: false, seenAt: NOW - 5_000 },
  { userId: "c", onPlay: true, seenAt: NOW - ONLINE_WITHIN_MS - 1 },
  { userId: "c", onPlay: false, seenAt: NOW - 2_000 },
  { userId: "a", onPlay: false, seenAt: NOW - 2_000 },
];

describe("Member presence", () => {
  it("is on Play, online or offline depending on the last heartbeat", () => {
    expect(presenceOf(rows, "a", NOW)).toBe("onPlay");
    expect(presenceOf(rows, "b", NOW)).toBe("online");
    expect(presenceOf(rows, "c", NOW)).toBe("online");
    expect(presenceOf(rows, "d", NOW)).toBe("offline");
  });

  it("is on Play when any of a Member's screens is, counting each Member once", () => {
    expect(countOnPlay([...rows, { userId: "a", onPlay: true, seenAt: NOW - 3_000 }], NOW)).toBe(1);
  });
});
