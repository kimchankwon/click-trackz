import { describe, expect, it } from "vitest";

import { beginDrag, endDrag, HOLD_MS, HOLD_SLOP, holdDecision, moveHold, startHold, type DragSession } from "./drag-session";

const ORDER = ["a#0", "b#0", "c#0", "d#0"];

describe("holdDecision", () => {
  it("waits while the finger is still and the hold is short", () => {
    const hold = startHold(100, 200, 1_000);
    expect(holdDecision(hold, 1_000 + HOLD_MS - 1)).toBe("wait");
  });

  it("starts the drag once the finger has stayed still for the whole hold", () => {
    const hold = moveHold(moveHold(startHold(100, 200, 1_000), 102, 203), 101, 199);
    expect(holdDecision(hold, 1_000 + HOLD_MS)).toBe("activate");
  });

  it("gives the touch to the scroll when the finger moves more than a few points", () => {
    const scrolling = moveHold(startHold(100, 200, 1_000), 100, 200 - HOLD_SLOP - 1);
    expect(holdDecision(scrolling, 1_010)).toBe("fail");
    expect(holdDecision(scrolling, 1_000 + HOLD_MS)).toBe("fail");
  });

  it("remembers movement even when the finger comes back before the hold ends", () => {
    const wandered = moveHold(moveHold(startHold(100, 200, 1_000), 100, 230), 100, 201);
    expect(holdDecision(wandered, 1_000 + HOLD_MS)).toBe("fail");
  });

  it("refuses when the row moved under a still finger, as in a slow scroll", () => {
    const hold = startHold(100, 200, 1_000);
    expect(holdDecision(hold, 1_000 + HOLD_MS, -40)).toBe("fail");
    expect(holdDecision(hold, 1_000 + HOLD_MS, HOLD_SLOP)).toBe("activate");
  });
});

describe("drag session", () => {
  const dragged = (to: number, owner: DragSession["owner"] = "hold"): DragSession => ({ ...beginDrag(null, "d#0", owner, ORDER, true)!, to });

  it("starts only when reordering is allowed and no other drag is running", () => {
    expect(beginDrag(null, "b#0", "handle", ORDER, true)).toEqual({ key: "b#0", owner: "handle", from: 1, to: 1, order: ORDER.join("|") });
    expect(beginDrag(null, "b#0", "handle", ORDER, false)).toBeNull();
    expect(beginDrag(dragged(0), "b#0", "handle", ORDER, true)).toBeNull();
    expect(beginDrag(null, "z#0", "handle", ORDER, true)).toBeNull();
  });

  it("saves nothing when the row is dropped where it started", () => {
    expect(endDrag(dragged(3), "d#0", "hold", false, ORDER)).toEqual({ kind: "none" });
  });

  it("saves nothing when the gesture was cancelled, for example by a scroll", () => {
    expect(endDrag(dragged(0), "d#0", "hold", true, ORDER)).toEqual({ kind: "none" });
  });

  it("saves the move when the row is dropped somewhere else", () => {
    expect(endDrag(dragged(0), "d#0", "hold", false, ORDER)).toEqual({ kind: "move", from: 3, to: 0 });
  });

  it("does not save over an order that changed during the drag", () => {
    expect(endDrag(dragged(0), "d#0", "hold", false, ["b#0", "a#0", "c#0", "d#0"])).toEqual({ kind: "stale" });
  });

  it("lets only the gesture that started the drag end it", () => {
    expect(endDrag(dragged(0, "handle"), "d#0", "hold", true, ORDER)).toEqual({ kind: "ignore" });
    expect(endDrag(dragged(0), "c#0", "hold", false, ORDER)).toEqual({ kind: "ignore" });
    expect(endDrag(null, "d#0", "hold", false, ORDER)).toEqual({ kind: "ignore" });
  });
});
