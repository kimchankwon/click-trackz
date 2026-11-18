import { trimDeviceLabel } from "@/lib/device-identity";

export const AUDIO_OUTPUTS_KEY = "audioOutputs";
export const MAX_REMEMBERED_OUTPUTS = 12;
const REFRESH_LAST_USED_MS = 24 * 60 * 60_000;

export type RememberedOutput = { id: string; name: string; lastUsedAt: number };

const isRemembered = (value: unknown): value is RememberedOutput => {
  if (typeof value !== "object" || value === null) return false;
  const { id, name, lastUsedAt } = value as Record<string, unknown>;
  return typeof id === "string" && id.length > 0 && typeof name === "string" && typeof lastUsedAt === "number" && Number.isFinite(lastUsedAt);
};

export function parseRememberedOutputs(stored: string | null): RememberedOutput[] {
  if (stored === null) return [];
  try {
    const parsed: unknown = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed.filter(isRemembered) : [];
  } catch {
    return [];
  }
}

export function rememberOutput(known: readonly RememberedOutput[], output: { id: string; name: string }, now: number): RememberedOutput[] | null {
  const name = trimDeviceLabel(output.name) || output.id;
  const seen = known.find((entry) => entry.id === output.id);
  if (seen && seen.name === name && now - seen.lastUsedAt < REFRESH_LAST_USED_MS) return null;
  const rest = known.filter((entry) => entry.id !== output.id);
  return [{ id: output.id, name, lastUsedAt: now }, ...rest].sort((a, b) => b.lastUsedAt - a.lastUsedAt).slice(0, MAX_REMEMBERED_OUTPUTS);
}
