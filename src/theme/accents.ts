import { accentIds, isAccentId, type AccentId } from "../../convex/accents";

export { accentIds, isAccentId, type AccentId };

export type AccentTokens = {
  accent: string;
  onAccent: string;
  accentSoft: string;
  accentTint: string;
};

export type AccentPalette = {
  label: string;
  light: AccentTokens;
  dark: AccentTokens;
};

export const defaultAccent: AccentId = "red";

const channel = (hex: string, index: number) => parseInt(hex.slice(1 + index * 2, 3 + index * 2), 16);

export function mixHex(foreground: string, background: string, weight: number): string {
  const mixed = [0, 1, 2].map((index) => Math.round(channel(foreground, index) * weight + channel(background, index) * (1 - weight)));
  return `#${mixed.map((value) => value.toString(16).padStart(2, "0")).join("").toUpperCase()}`;
}

const light = (accent: string): AccentTokens => ({
  accent,
  onAccent: "#FFFFFF",
  accentSoft: mixHex(accent, "#FFFFFF", 0.2),
  accentTint: mixHex(accent, "#FFFFFF", 0.08),
});

const dark = (accent: string): AccentTokens => ({
  accent,
  onAccent: "#000000",
  accentSoft: mixHex(accent, "#000000", 0.3),
  accentTint: mixHex(accent, "#000000", 0.18),
});

export const accentPalettes: Record<AccentId, AccentPalette> = {
  red: {
    label: "Red",
    light: { accent: "#CF3B22", onAccent: "#FFFFFF", accentSoft: "#F8D3CB", accentTint: "#FCEAE5" },
    dark: { accent: "#FF6A4D", onAccent: "#000000", accentSoft: "#4A2018", accentTint: "#2E1510" },
  },
  orange: { label: "Orange", light: light("#C2410C"), dark: dark("#FB923C") },
  green: { label: "Green", light: light("#15803D"), dark: dark("#4ADE80") },
  teal: { label: "Teal", light: light("#0F766E"), dark: dark("#2DD4BF") },
  blue: { label: "Blue", light: light("#2563EB"), dark: dark("#60A5FA") },
  purple: { label: "Purple", light: light("#7C3AED"), dark: dark("#A78BFA") },
  pink: { label: "Pink", light: light("#BE185D"), dark: dark("#F472B6") },
};
