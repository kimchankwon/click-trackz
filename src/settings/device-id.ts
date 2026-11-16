import { isDeviceId } from "@/lib/device-identity";

import { deviceStore } from "./device-store";

const DEVICE_ID_KEY = "deviceId";

let known: string | null = null;

const newDeviceId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;

export function deviceId(): string {
  if (known !== null) return known;
  const stored = deviceStore.getSync(DEVICE_ID_KEY);
  known = stored !== null && isDeviceId(stored) ? stored : newDeviceId();
  if (known !== stored) deviceStore.set(DEVICE_ID_KEY, known).catch(() => undefined);
  return known;
}
