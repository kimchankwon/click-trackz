import { describe, expect, it } from "vitest";

import { LIMITER_RANGE, limiterCurve, OUTPUT_BOOST, softLimit } from "./output-level";

const heard = (signal: number) => {
  const curve = limiterCurve();
  const input = (signal * OUTPUT_BOOST) / LIMITER_RANGE;
  return curve[Math.round(((input + 1) / 2) * (curve.length - 1))];
};

describe("Output level", () => {
  it("plays ordinary sounds 30% louder", () => {
    expect(heard(0.5)).toBeCloseTo(0.65, 2);
    expect(heard(-0.4)).toBeCloseTo(-0.52, 2);
  });

  it("rounds off the loudest peaks instead of clipping them", () => {
    expect(heard(1)).toBeLessThan(1);
    expect(heard(1)).toBeGreaterThan(heard(0.8));
    expect(Math.max(...limiterCurve().map(Math.abs))).toBeLessThan(1);
  });

  it("never turns a louder input into a quieter output", () => {
    const levels = Array.from({ length: 31 }, (_, index) => index / 10);
    const shaped = levels.map(softLimit);
    expect(shaped.every((level, index) => index === 0 || level >= shaped[index - 1])).toBe(true);
  });
});
