import { describe, expect, it, vi } from "vitest";

import { saveThen } from "./save-then";

describe("saveThen", () => {
  it("saves first, then runs the next step", async () => {
    const order: string[] = [];
    const result = await saveThen(
      async () => order.push("save"),
      async () => {
        order.push("copy");
        return "copied";
      },
      () => true,
    );
    expect(order).toEqual(["save", "copy"]);
    expect(result).toBe("copied");
  });

  it("skips the next step when it was cancelled during the save", async () => {
    let wanted = true;
    const next = vi.fn(async () => "copied");
    const result = await saveThen(
      async () => {
        wanted = false;
      },
      next,
      () => wanted,
    );
    expect(next).not.toHaveBeenCalled();
    expect(result).toBeNull();
  });

  it("runs the next step straight away when there is nothing to save", async () => {
    const next = vi.fn(async () => "copied");
    expect(await saveThen(null, next, () => false)).toBe("copied");
    expect(next).toHaveBeenCalledOnce();
  });
});
