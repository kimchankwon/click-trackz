import { deviceStore } from "@/settings/device-store";

import { normalizeJoinCode } from "./invite";

const PENDING_JOIN_KEY = "pendingJoinCode";

export const readPendingJoin = (): string | null => normalizeJoinCode(deviceStore.getSync(PENDING_JOIN_KEY));

export const savePendingJoin = (code: string) => deviceStore.set(PENDING_JOIN_KEY, code).catch(() => undefined);

export const clearPendingJoin = () => deviceStore.set(PENDING_JOIN_KEY, "").catch(() => undefined);
