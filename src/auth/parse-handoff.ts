export type StoredHandoff = { token: string };

export function parseHandoff(json: string | null): StoredHandoff | null {
  if (json === null) return null;
  try {
    const value: unknown = JSON.parse(json);
    return typeof value === "object" && value !== null && typeof (value as StoredHandoff).token === "string" ? { token: (value as StoredHandoff).token } : null;
  } catch {
    return null;
  }
}
