import { describe, expect, it } from "vitest";

import { countOnPlay, lastSeenOf, memberPing, onlineCount, otherMemberPing, presenceOf, ONLINE_WITHIN_MS } from "./online";

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

  it("reports a Member's ping from their most recent screen that measured one", () => {
    const pings = [
      { userId: "a", onPlay: true, seenAt: NOW - 9_000, roundTripMs: 120 },
      { userId: "a", onPlay: false, seenAt: NOW - 2_000, roundTripMs: 35 },
      { userId: "a", onPlay: false, seenAt: NOW - 1_000, roundTripMs: null },
      { userId: "b", onPlay: true, seenAt: NOW - ONLINE_WITHIN_MS - 1, roundTripMs: 40 },
    ];
    expect(memberPing(pings, "a", NOW)).toBe(35);
    expect(memberPing(pings, "b", NOW)).toBeNull();
  });

  it("shows other Members' ping but never the viewer's own, and nothing until the viewer is known", () => {
    const pings = [
      { userId: "a", onPlay: true, seenAt: NOW - 1_000, roundTripMs: 35 },
      { userId: "b", onPlay: false, seenAt: NOW - 2_000, roundTripMs: 60 },
    ];
    expect(otherMemberPing(pings, "a", "a", NOW)).toBeNull();
    expect(otherMemberPing(pings, "b", "a", NOW)).toBe(60);
    expect(otherMemberPing(pings, "a", undefined, NOW)).toBeNull();
    expect(otherMemberPing(pings, "b", undefined, NOW)).toBeNull();
  });

  it("is on Play when any of a Member's screens is, counting each Member once", () => {
    expect(countOnPlay([...rows, { userId: "a", onPlay: true, seenAt: NOW - 3_000 }], NOW)).toBe(1);
  });
});

describe("onlineCount", () => {
  it("counts Members seen within the online window", () => {
    expect(onlineCount([NOW, NOW - ONLINE_WITHIN_MS, NOW - ONLINE_WITHIN_MS - 1], NOW)).toBe(2);
    expect(onlineCount([], NOW)).toBe(0);
  });
});

describe("lastSeenOf", () => {
  it("takes the later of the Member's saved last visit and their newest screen", () => {
    const screens = [{ userId: "a", onPlay: false, seenAt: 500 }, { userId: "a", onPlay: true, seenAt: 900 }, { userId: "b", onPlay: false, seenAt: 2_000 }];
    expect(lastSeenOf(screens, "a", 700)).toBe(900);
    expect(lastSeenOf(screens, "a", 1_200)).toBe(1_200);
    expect(lastSeenOf([], "c", null)).toBeNull();
  });
});
