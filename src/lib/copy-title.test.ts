import { describe, expect, it } from "vitest";

import { copyBaseOf, copyTitle, MAX_GROUP_NAME, MAX_SONG_TITLE } from "./copy-title";

describe("copyTitle", () => {
  it("numbers the first copy 2", () => {
    expect(copyTitle("Remembrance", ["Remembrance"])).toBe("Remembrance 2");
  });

  it("takes the next free number, ignoring case", () => {
    expect(copyTitle("Remembrance", ["Remembrance", "remembrance 2", "Remembrance 4"])).toBe("Remembrance 3");
  });

  it("shortens a long title so the copy still fits", () => {
    const long = "A".repeat(MAX_SONG_TITLE);
    const copy = copyTitle(long, [long]);
    expect(copy).toHaveLength(MAX_SONG_TITLE);
    expect(copy.endsWith(" 2")).toBe(true);
    expect(copyTitle("B".repeat(MAX_GROUP_NAME), [], MAX_GROUP_NAME)).toHaveLength(MAX_GROUP_NAME);
  });
});

describe("copyBaseOf", () => {
  it("numbers a copy of a copy from the title it was copied from", () => {
    expect(copyBaseOf({ title: "Remembrance 2", copyBase: "Remembrance" })).toBe("Remembrance");
  });

  it("keeps a number that belongs to the title, whatever else is in the library", () => {
    expect(copyBaseOf({ title: "Psalm 23" })).toBe("Psalm 23");
    expect(copyBaseOf({ title: "Psalm 23", copyBase: null })).toBe("Psalm 23");
  });

  it("starts from the new title once a copy is renamed", () => {
    expect(copyBaseOf({ title: "Remembrance acoustic", copyBase: "Remembrance" })).toBe("Remembrance acoustic");
    expect(copyBaseOf({ title: "Remembrance 2 live", copyBase: "Remembrance" })).toBe("Remembrance 2 live");
  });
});
