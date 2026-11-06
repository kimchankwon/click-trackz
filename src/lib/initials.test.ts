import { describe, expect, it } from "vitest";

import { initialsOf } from "./initials";

describe("initialsOf", () => {
  it("uses one letter for a single word", () => {
    expect(initialsOf("jisue")).toBe("J");
  });

  it("uses both initials when there is a space", () => {
    expect(initialsOf("Deep A")).toBe("DA");
    expect(initialsOf("sam lee")).toBe("SL");
  });

  it("uses the first and last word for longer names", () => {
    expect(initialsOf("Mary Jane Smith")).toBe("MS");
  });

  it("ignores extra spaces", () => {
    expect(initialsOf("  Alex   Park  ")).toBe("AP");
  });

  it("keeps letters outside the basic plane whole", () => {
    expect(initialsOf("𝒜da 김찬")).toBe("𝒜김");
  });

  it("falls back to a question mark for a blank name", () => {
    expect(initialsOf("   ")).toBe("?");
  });
});
