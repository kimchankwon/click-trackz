import { describe, expect, it } from "vitest";

import { carouselSlot, sideScaleFor } from "./section-carousel";

const WIDTH = 343;
const SIDE = 76;
const TITLE_WIDTH = WIDTH - 2 * (SIDE + 8);
const scale = sideScaleFor(40, TITLE_WIDTH, SIDE);

describe("Section carousel", () => {
  it("puts the current Section in the middle at full size", () => {
    expect(carouselSlot(0, WIDTH, SIDE, scale)).toEqual({ centreX: WIDTH / 2, scale: 1, drop: 0, opacity: 1 });
  });

  it("puts the previous and next Sections in the side columns, small", () => {
    expect(carouselSlot(-1, WIDTH, SIDE, scale).centreX).toBe(SIDE / 2);
    expect(carouselSlot(1, WIDTH, SIDE, scale).centreX).toBe(WIDTH - SIDE / 2);
    expect(carouselSlot(1, WIDTH, SIDE, scale).scale).toBeCloseTo(14 / 40);
  });

  it("grows a Section as it slides from the next column to the middle", () => {
    const halfway = carouselSlot(0.5, WIDTH, SIDE, scale);
    expect(halfway.centreX).toBeCloseTo(WIDTH / 2 + (WIDTH / 2 - SIDE / 2) / 2);
    expect(halfway.scale).toBeCloseTo(1 - (1 - 14 / 40) / 2);
  });

  it("fades a Section out as it slides past the previous column", () => {
    expect(carouselSlot(-1.5, WIDTH, SIDE, scale).opacity).toBeCloseTo(0.5);
    expect(carouselSlot(-2, WIDTH, SIDE, scale).opacity).toBe(0);
  });

  it("keeps a long side title inside its column so its ends are not cut off", () => {
    const titleWidth = 402 - 48 - 2 * (SIDE + 8);
    const longTitle = sideScaleFor(32, titleWidth, SIDE);
    expect(titleWidth * longTitle).toBeLessThanOrEqual(SIDE - 4);
    expect(carouselSlot(1, 402 - 48, SIDE, longTitle).centreX + (titleWidth * longTitle) / 2).toBeLessThan(402 - 48);
  });

  it("uses the readable side size when the title already fits", () => {
    expect(sideScaleFor(40, TITLE_WIDTH, SIDE)).toBeCloseTo(14 / 40);
    expect(sideScaleFor(32, 0, SIDE)).toBeCloseTo(14 / 32);
  });
});
