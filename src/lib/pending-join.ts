import { deviceStore } from "@/settings/device-store";

import { normalizeJoinCode } from "./invite";

const PENDING_JOIN_KEY = "pendingJoinCode";

let thisSession: { code: string | null } | null = null;

export const readPendingJoin = (): string | null =>
  thisSession ? thisSession.code : normalizeJoinCode(deviceStore.getSync(PENDING_JOIN_KEY));

export function savePendingJoin(code: string) {
  thisSession = { code };
  return deviceStore.set(PENDING_JOIN_KEY, code).catch(() => undefined);
}

export function clearPendingJoin() {
  thisSession = { code: null };
  return deviceStore.set(PENDING_JOIN_KEY, "").catch(() => undefined);
}
