import { describe, expect, it } from "vitest";

import { inviteLink, inviteText, normalizeJoinCode } from "./invite";

describe("invite links", () => {
  it("accepts a join code in any case, with spaces or dashes", () => {
    expect(normalizeJoinCode("bzfym9")).toBe("BZFYM9");
    expect(normalizeJoinCode(" BZF-YM9 ")).toBe("BZFYM9");
    expect(normalizeJoinCode(["k2h7wq", "ignored"])).toBe("K2H7WQ");
  });

  it("rejects anything a Group could not have as its code", () => {
    expect(normalizeJoinCode("BZFYM")).toBeNull();
    expect(normalizeJoinCode("BZFYM9X")).toBeNull();
    expect(normalizeJoinCode("BZFYO9")).toBeNull();
    expect(normalizeJoinCode("BZFY19")).toBeNull();
    expect(normalizeJoinCode(undefined)).toBeNull();
  });

  it("builds a join link on the site, with or without a trailing slash", () => {
    expect(inviteLink("https://cue-tracker-six.vercel.app", "BZFYM9")).toBe("https://cue-tracker-six.vercel.app/join/BZFYM9");
    expect(inviteLink("https://cue-tracker-six.vercel.app/", "BZFYM9")).toBe("https://cue-tracker-six.vercel.app/join/BZFYM9");
  });

  it("names the Group in the message", () => {
    expect(inviteText("Worship Band")).toBe("Join Worship Band on Cue Tracker");
  });
});
