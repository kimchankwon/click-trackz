import { describe, expect, it } from "vitest";

import { holdRestart, restartHeld } from "./restart-hold";

describe("restart holds", () => {
  it("is held while any hold is in place", () => {
    expect(restartHeld()).toBe(false);
    const playing = holdRestart();
    const editing = holdRestart();
    playing();
    expect(restartHeld()).toBe(true);
    editing();
    expect(restartHeld()).toBe(false);
  });

  it("counts a release once even when called twice", () => {
    const playing = holdRestart();
    const editing = holdRestart();
    playing();
    playing();
    expect(restartHeld()).toBe(true);
    editing();
    expect(restartHeld()).toBe(false);
  });
});
