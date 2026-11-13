import { describe, expect, it } from "vitest";

import { placeMenu } from "./menu-placement";

const phone = { width: 390, height: 844 };

describe("placeMenu", () => {
  it("opens below the button when the menu fits there", () => {
    expect(placeMenu({ x: 40, y: 100, width: 200, height: 44 }, phone, { height: 220, minWidth: 0 })).toEqual({ left: 40, top: 148, width: 200, height: 220 });
  });

  it("opens above a button near the bottom of the screen", () => {
    expect(placeMenu({ x: 40, y: 700, width: 200, height: 44 }, phone, { height: 220, minWidth: 0 })).toEqual({ left: 40, top: 476, width: 200, height: 220 });
  });

  it("widens a narrow button's menu and keeps it inside the screen gutter", () => {
    expect(placeMenu({ x: 320, y: 100, width: 56, height: 44 }, phone, { height: 220, minWidth: 140 })).toEqual({ left: 234, top: 148, width: 140, height: 220 });
  });

  it("shrinks a long menu to the room on the roomier side and scrolls it", () => {
    expect(placeMenu({ x: 40, y: 400, width: 80, height: 44 }, phone, { height: 2000, minWidth: 0 })).toEqual({ left: 40, top: 448, width: 80, height: 380 });
  });
});
