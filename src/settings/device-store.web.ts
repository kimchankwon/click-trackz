import { readLocalValue } from "@/lib/device-store.web";

import { notifyDeviceSetting } from "./device-setting-events";

if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if (event.storageArea === window.localStorage && event.key !== null && event.newValue !== null) notifyDeviceSetting(event.key, event.newValue);
  });
}

export const deviceStore = {
  get: async (key: string): Promise<string | null> => readLocalValue(key),
  getSync: readLocalValue,
  set: async (key: string, value: string): Promise<void> => {
    notifyDeviceSetting(key, value);
    window.localStorage.setItem(key, value);
  },
};
