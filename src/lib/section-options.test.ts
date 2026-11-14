import { describe, expect, it } from "vitest";

import { timeOfKey, timeOptions } from "./section-options";

describe("Section options", () => {
  it("lists a time signature outside the common ones first, and reads a choice back", () => {
    expect(timeOptions({ beatsPerBar: 11, beatUnit: 8 })[0].value).toBe("11/8");
    expect(timeOptions({ beatsPerBar: 4 }).filter((option) => option.value === "4/4")).toHaveLength(1);
    expect(timeOfKey("7/8")).toEqual({ beatsPerBar: 7, beatUnit: 8 });
  });
});
