import { describe, expect, it } from "vitest";

import { carouselSlot, sideScaleFor } from "./section-carousel";

const WIDTH = 343;
const SIDE = 76;
const scale = sideScaleFor(40);

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
});
