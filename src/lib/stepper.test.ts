import { describe, expect, it } from "vitest";

import { digitsIn, settledNumber, steppedLetter, steppedNumber, typedLetter, typedNumber } from "./stepper";

const bars = { min: 1, max: 100 };
const bpm = { min: 30, max: 300, optional: true };
const number = { min: 1, max: 9, optional: true };

describe("number steppers", () => {
  it("keeps only digits, no longer than the largest value", () => {
    expect(digitsIn("1a2.5", bars)).toBe("125");
    expect(digitsIn("-7", bars)).toBe("7");
    expect(digitsIn("12", number)).toBe("1");
  });

  it("takes a typed value only once it is in range", () => {
    expect(typedNumber("8", bars)).toBe(8);
    expect(typedNumber("0", bars)).toBeNull();
    expect(typedNumber("101", bars)).toBeNull();
    expect(typedNumber("7", bpm)).toBeNull();
    expect(typedNumber("72", bpm)).toBe(72);
    expect(typedNumber("", bars)).toBeNull();
    expect(typedNumber("", number)).toBeUndefined();
  });

  it("settles what was typed into range when the field is left", () => {
    expect(settledNumber("150", bars, 4)).toBe(100);
    expect(settledNumber("0", bars, 4)).toBe(1);
    expect(settledNumber("", bars, 4)).toBe(4);
    expect(settledNumber("", number, 2)).toBeUndefined();
    expect(settledNumber("12", bpm, undefined)).toBe(30);
  });

  it("steps by one inside the range", () => {
    expect(steppedNumber(4, 1, bars)).toBe(5);
    expect(steppedNumber(100, 1, bars)).toBe(100);
    expect(steppedNumber(1, -1, bars)).toBe(1);
    expect(steppedNumber(undefined, 1, number)).toBe(1);
    expect(steppedNumber(1, -1, number)).toBeUndefined();
    expect(steppedNumber(undefined, -1, number)).toBeUndefined();
  });

  it("steps an empty field from the value it shows", () => {
    expect(steppedNumber(undefined, 1, bpm, 72)).toBe(73);
    expect(steppedNumber(undefined, -1, bpm, 72)).toBe(71);
  });
});

describe("letter steppers", () => {
  it("keeps the last letter typed, in capitals", () => {
    expect(typedLetter("b")).toBe("B");
    expect(typedLetter("Ac")).toBe("C");
    expect(typedLetter("3")).toBeUndefined();
    expect(typedLetter("")).toBeUndefined();
  });

  it("steps through the alphabet", () => {
    expect(steppedLetter(undefined, 1)).toBe("A");
    expect(steppedLetter("A", 1)).toBe("B");
    expect(steppedLetter("Z", 1)).toBe("Z");
    expect(steppedLetter("B", -1)).toBe("A");
    expect(steppedLetter("A", -1)).toBeUndefined();
    expect(steppedLetter(undefined, -1)).toBeUndefined();
  });
});
