import { describe, expect, it } from "vitest";

import { pickPreviewPhrase } from "./preview-phrase";

const KEYS = ["intro", "verse", "chorus", "verse-2", "ending", "count-1", "count-2"] as const;
const PHRASES = ["intro", "verse", "chorus", "verse-2", "ending"];

describe("pickPreviewPhrase", () => {
  it("picks across every Section phrase and never a count", () => {
    const rolls = [0, 0.2, 0.4, 0.6, 0.8, 0.999999];
    const picked = new Set(rolls.map((roll) => pickPreviewPhrase(KEYS, null, () => roll)));
    expect([...picked].sort()).toEqual([...PHRASES].sort());
  });

  it("never says the same phrase twice in a row", () => {
    for (const previous of PHRASES) {
      for (const roll of [0, 0.3, 0.6, 0.999999]) expect(pickPreviewPhrase(KEYS, previous as (typeof KEYS)[number], () => roll)).not.toBe(previous);
    }
  });

  it("repeats the only phrase there is", () => {
    expect(pickPreviewPhrase(["chorus", "count-1"], "chorus", () => 0.5)).toBe("chorus");
  });
});
