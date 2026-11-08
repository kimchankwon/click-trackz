import { describe, expect, it } from "vitest";

import { copyTitle, MAX_SONG_TITLE } from "./copy-title";

describe("copyTitle", () => {
  it("numbers the first copy 2", () => {
    expect(copyTitle("Remembrance", ["Remembrance"])).toBe("Remembrance 2");
  });

  it("takes the next free number, ignoring case", () => {
    expect(copyTitle("Remembrance", ["Remembrance", "remembrance 2", "Remembrance 4"])).toBe("Remembrance 3");
  });

  it("numbers a copy of a copy from the original title", () => {
    expect(copyTitle("Remembrance 2", ["Remembrance", "Remembrance 2"])).toBe("Remembrance 3");
  });

  it("keeps a number that belongs to the title", () => {
    expect(copyTitle("Psalm 23", ["Psalm 23"])).toBe("Psalm 23 2");
  });

  it("shortens a long title so the copy still fits", () => {
    const long = "A".repeat(MAX_SONG_TITLE);
    const copy = copyTitle(long, [long]);
    expect(copy).toHaveLength(MAX_SONG_TITLE);
    expect(copy.endsWith(" 2")).toBe(true);
  });
});
