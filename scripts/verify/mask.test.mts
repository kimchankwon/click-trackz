import { describe, expect, it } from "vitest";

import { cropRect, maskRects, shapeMask, type HierarchyNode } from "./mask.mts";

const node = (bounds: string, id = "", children: HierarchyNode[] = []): HierarchyNode => ({ attributes: { "resource-id": id, bounds }, children });

const tree = node("[0,0][0,0]", "", [
  node("[0,0][402,874]", "", [
    node("[10,20][110,40]", "copy-join-code"),
    node("[300,20][350,40]", "clock-status"),
    node("[300,20][300,40]", "clock-status"),
    node("[0,500][402,600]", "other"),
  ]),
]);

describe("shapeMask", () => {
  const element = { x: 10, y: 20, width: 100, height: 20 };

  it("uses the element's bounds for a plain test ID", () => {
    expect(shapeMask("copy-join-code", element, 402)).toEqual(element);
  });

  it("fixes the width from the element's left edge", () => {
    expect(shapeMask({ testId: "copy-join-code", width: 120 }, element, 402)).toEqual({ x: 10, y: 20, width: 120, height: 20 });
  });

  it("counts a negative x from the right edge of the screen", () => {
    expect(shapeMask({ testId: "clock-status", x: -160, width: 160 }, element, 402)).toEqual({ x: 242, y: 20, width: 160, height: 20 });
  });
});

describe("maskRects", () => {
  it("scales each matching element's mask from points to image pixels", () => {
    expect(maskRects(tree, ["copy-join-code", { testId: "clock-status", x: -102, width: 102 }], 1206)).toEqual({
      rects: [
        { x: 30, y: 60, width: 300, height: 60 },
        { x: 900, y: 60, width: 306, height: 60 },
      ],
      missing: [],
    });
  });

  it("names the test IDs it could not find", () => {
    expect(maskRects(tree, ["copy-join-code", "stage-member-Admin"], 402).missing).toEqual(["stage-member-Admin"]);
  });

  it("does not count an optional test ID that is off screen as missing", () => {
    expect(maskRects(tree, ["copy-join-code", { testId: "stage-ping-Admin", optional: true }], 402)).toEqual({
      rects: [{ x: 10, y: 20, width: 100, height: 20 }],
      missing: [],
    });
  });

  it("finds nothing in a tree without bounds", () => {
    expect(maskRects({ attributes: {} }, ["copy-join-code"], 1206)).toEqual({ rects: [], missing: ["copy-join-code"] });
  });
});

describe("cropRect", () => {
  const page: HierarchyNode = {
    attributes: { bounds: "[0,0][402,874]" },
    children: [{ attributes: { text: "Every device starts on the same timing", bounds: "[20,200][380,260]" } }],
  };

  it("places the crop relative to the anchor text, scaled to image pixels", () => {
    expect(cropRect(page, { text: "Every device starts on the same timing", top: -30, height: 245 }, 1206)).toEqual({ x: 0, y: 510, width: 1206, height: 735 });
  });

  it("returns null when the anchor text is not on screen", () => {
    expect(cropRect(page, { text: "From rehearsals to the stage", top: 0, height: 100 }, 1206)).toBeNull();
  });
});
