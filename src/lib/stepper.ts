export type NumberRange = { min: number; max: number; optional?: boolean };

const clamp = (value: number, { min, max }: NumberRange) => Math.min(max, Math.max(min, value));

export const digitsIn = (text: string, { max }: NumberRange) => (text.split(/[.,]/)[0] ?? "").replace(/\D/g, "").slice(0, String(max).length);

export function typedNumber(digits: string, range: NumberRange): number | undefined | null {
  if (digits === "") return range.optional ? undefined : null;
  const value = Number(digits);
  return value >= range.min && value <= range.max ? value : null;
}

export function settledNumber(digits: string, range: NumberRange, current: number | undefined): number | undefined {
  if (digits === "") return range.optional ? undefined : current;
  return clamp(Number(digits), range);
}

export function steppedNumber(value: number | undefined, by: 1 | -1, range: NumberRange, from = value): number | undefined {
  if (from === undefined) return by > 0 ? range.min : undefined;
  const next = from + by;
  if (next < range.min) return range.optional && value !== undefined ? undefined : range.min;
  return clamp(next, range);
}

export const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export function typedLetter(text: string): string | undefined {
  const letters = text.toUpperCase().replace(/[^A-Z]/g, "");
  return letters === "" ? undefined : letters[letters.length - 1];
}

export function steppedLetter(value: string | undefined, by: 1 | -1): string | undefined {
  if (value === undefined) return by > 0 ? LETTERS[0] : undefined;
  const index = LETTERS.indexOf(value) + by;
  if (index < 0) return undefined;
  return LETTERS[Math.min(LETTERS.length - 1, index)];
}
