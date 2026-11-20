import { isRecord } from "@/lib/is-record";

export function parseHandoff(json: string | null): { token: string } | null {
  if (json === null) return null;
  try {
    const value: unknown = JSON.parse(json);
    return isRecord(value) && typeof value.token === "string" ? { token: value.token } : null;
  } catch {
    return null;
  }
}
