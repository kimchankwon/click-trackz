import { describe, expect, it } from "vitest";

import { sectionProgressAt } from "./section-progress";

describe("sectionProgressAt", () => {
  it("fills across the whole Section one beat at a time", () => {
    expect(sectionProgressAt({ beatInBar: 1, beatsPerBar: 4, barInSection: 1, barsInSection: 16 })).toEqual({ from: 0, to: 1 / 64 });
    expect(sectionProgressAt({ beatInBar: 3, beatsPerBar: 4, barInSection: 9, barsInSection: 16 })).toEqual({ from: 34 / 64, to: 35 / 64 });
    expect(sectionProgressAt({ beatInBar: 4, beatsPerBar: 4, barInSection: 16, barsInSection: 16 })).toEqual({ from: 63 / 64, to: 1 });
  });
});
