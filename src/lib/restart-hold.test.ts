import { afterEach, describe, expect, it, vi } from "vitest";

import { holdRestart, restartHeld, restartWhenFree } from "./restart-hold";

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

describe("restartWhenFree", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("restarts once the current effects have run and nothing holds", () => {
    vi.useFakeTimers();
    const restart = vi.fn();
    restartWhenFree(restart);
    expect(restart).not.toHaveBeenCalled();
    vi.runAllTimers();
    expect(restart).toHaveBeenCalledTimes(1);
  });

  it("does not restart when an edit takes a hold in the same render as the update", () => {
    vi.useFakeTimers();
    const restart = vi.fn();
    restartWhenFree(restart);
    const editing = holdRestart();
    vi.runAllTimers();
    expect(restart).not.toHaveBeenCalled();
    editing();
  });

  it("does not restart after it is cancelled", () => {
    vi.useFakeTimers();
    const restart = vi.fn();
    const cancel = restartWhenFree(restart);
    cancel();
    vi.runAllTimers();
    expect(restart).not.toHaveBeenCalled();
  });
});
