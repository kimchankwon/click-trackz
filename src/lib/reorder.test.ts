import { describe, expect, it } from "vitest";

import { dropSlot, keysWithRepeats, moveItem, slotsWhileDragging } from "./reorder";

describe("moveItem", () => {
  it("moves an item down or up and shifts the ones between", () => {
    expect(moveItem(["a", "b", "c", "d"], 0, 2)).toEqual(["b", "c", "a", "d"]);
    expect(moveItem(["a", "b", "c", "d"], 3, 1)).toEqual(["a", "d", "b", "c"]);
  });

  it("leaves the order alone for a drop in place or out of range", () => {
    expect(moveItem(["a", "b"], 1, 1)).toEqual(["a", "b"]);
    expect(moveItem(["a", "b"], 0, 5)).toEqual(["a", "b"]);
  });
});

describe("slotsWhileDragging", () => {
  it("makes room where the dragged row would land", () => {
    expect(slotsWhileDragging(4, 0, 2)).toEqual([2, 0, 1, 3]);
    expect(slotsWhileDragging(4, 3, 1)).toEqual([0, 2, 3, 1]);
    expect(slotsWhileDragging(3, 1, 1)).toEqual([0, 1, 2]);
  });

  it("agrees with the order moveItem saves", () => {
    const items = ["a", "b", "c", "d", "e"];
    const slots = slotsWhileDragging(items.length, 4, 1);
    const shown: string[] = [];
    slots.forEach((slot, index) => (shown[slot] = items[index]));
    expect(shown).toEqual(moveItem(items, 4, 1));
  });
});

describe("dropSlot", () => {
  it("rounds the drag to the nearest row and stays inside the list", () => {
    expect(dropSlot(1, 70, 58, 5)).toBe(2);
    expect(dropSlot(1, 20, 58, 5)).toBe(1);
    expect(dropSlot(1, -400, 58, 5)).toBe(0);
    expect(dropSlot(1, 900, 58, 5)).toBe(4);
  });
});

describe("keysWithRepeats", () => {
  it("tells apart a Song that is in the Setlist twice", () => {
    expect(keysWithRepeats(["a", "b", "a"])).toEqual(["a#0", "b#0", "a#1"]);
  });
});
