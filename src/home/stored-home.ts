import type { FunctionReturnType } from "convex/server";

import type { api } from "../../convex/_generated/api";

export const HOME_FORMAT = 1;

export type MyGroups = FunctionReturnType<typeof api.groups.myGroups>;

export type StoredHome = { format: typeof HOME_FORMAT; isAnonymous: boolean; groups: MyGroups };

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

const isGroup = (value: unknown) =>
  isRecord(value) &&
  typeof value.groupId === "string" &&
  typeof value.name === "string" &&
  typeof value.role === "string" &&
  typeof value.offline === "boolean" &&
  typeof value.locked === "boolean" &&
  typeof value.owned === "boolean";

export function parseStoredHome(json: string | null): StoredHome | null {
  if (json === null) return null;
  try {
    const value: unknown = JSON.parse(json);
    if (!isRecord(value) || value.format !== HOME_FORMAT || typeof value.isAnonymous !== "boolean" || !Array.isArray(value.groups) || !value.groups.every(isGroup)) {
      return null;
    }
    return value as StoredHome;
  } catch {
    return null;
  }
}
