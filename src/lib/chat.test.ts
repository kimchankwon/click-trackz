import { describe, expect, it } from "vitest";

import { bubblesAt, cleanComment, isFloating, isReaction, nextBubbleChangeIn } from "./chat";

describe("Comments", () => {
  it("tidies spaces and line breaks", () => {
    expect(cleanComment("  nice\n\n  one  ")).toBe("nice one");
  });

  it("shows each Member's latest Comment above their avatar for 10 seconds", () => {
    const comments = [
      { userId: "a", text: "first", at: 1_000 },
      { userId: "a", text: "second", at: 4_000 },
      { userId: "b", text: "old", at: 0 },
    ];
    const bubbles = bubblesAt(comments, 10_500);
    expect(bubbles.get("a")?.text).toBe("second");
    expect(bubbles.has("b")).toBe(false);
    expect(bubblesAt(comments, 14_000).size).toBe(0);
  });

  it("wakes when the next bubble should go", () => {
    expect(nextBubbleChangeIn([{ userId: "a", text: "x", at: 1_000 }], 5_000)).toBe(6_000);
    expect(nextBubbleChangeIn([{ userId: "a", text: "x", at: 1_000 }], 20_000)).toBeNull();
  });
});

describe("Reactions", () => {
  it("accepts only the offered Reactions", () => {
    expect(isReaction("🔥")).toBe(true);
    expect(isReaction("💩")).toBe(false);
  });

  it("floats a Reaction for a few seconds after it was sent, allowing for a little clock error", () => {
    expect(isFloating(10_000, 11_000)).toBe(true);
    expect(isFloating(10_000, 9_500)).toBe(true);
    expect(isFloating(10_000, 14_000)).toBe(false);
  });
});
