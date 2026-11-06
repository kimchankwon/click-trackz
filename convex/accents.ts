export const accentIds = ["red", "orange", "green", "teal", "blue", "purple", "pink"] as const;

export type AccentId = (typeof accentIds)[number];

export const isAccentId = (value: unknown): value is AccentId =>
  typeof value === "string" && (accentIds as readonly string[]).includes(value);
