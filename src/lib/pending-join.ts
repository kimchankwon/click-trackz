import { deviceStore } from "@/settings/device-store";

import { normalizeJoinCode } from "./invite";

const PENDING_JOIN_KEY = "pendingJoinCode";

let remembered: string | null = null;

export const readPendingJoin = (): string | null => remembered ?? normalizeJoinCode(deviceStore.getSync(PENDING_JOIN_KEY));

export function savePendingJoin(code: string) {
  remembered = code;
  return deviceStore.set(PENDING_JOIN_KEY, code).catch(() => undefined);
}

export function clearPendingJoin() {
  remembered = null;
  return deviceStore.set(PENDING_JOIN_KEY, "").catch(() => undefined);
}
