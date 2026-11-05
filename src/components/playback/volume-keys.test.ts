import { describe, expect, it } from "vitest";

import { volumeForKey } from "./volume-keys";

describe("volumeForKey", () => {
  it("raises the volume one step with the right and up arrows", () => {
    expect(volumeForKey(0.5, "ArrowRight")).toBeCloseTo(0.6);
    expect(volumeForKey(0.5, "ArrowUp")).toBeCloseTo(0.6);
  });

  it("lowers the volume one step with the left and down arrows", () => {
    expect(volumeForKey(0.5, "ArrowLeft")).toBeCloseTo(0.4);
    expect(volumeForKey(0.5, "ArrowDown")).toBeCloseTo(0.4);
  });

  it("stays within silent and full", () => {
    expect(volumeForKey(0.95, "ArrowUp")).toBe(1);
    expect(volumeForKey(0.05, "ArrowDown")).toBe(0);
  });

  it("jumps to silent with Home and full with End", () => {
    expect(volumeForKey(0.5, "Home")).toBe(0);
    expect(volumeForKey(0.5, "End")).toBe(1);
  });

  it("ignores other keys", () => {
    expect(volumeForKey(0.5, "Tab")).toBeNull();
    expect(volumeForKey(0.5, "a")).toBeNull();
  });
});
