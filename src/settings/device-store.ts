import * as SecureStore from "expo-secure-store";

import { notifyDeviceSetting } from "./device-setting-events";

export const deviceStore = {
  get: (key: string) => SecureStore.getItemAsync(key),
  getSync: (key: string): string | null => {
    try {
      return SecureStore.getItem(key);
    } catch {
      return null;
    }
  },
  set: async (key: string, value: string) => {
    notifyDeviceSetting(key, value);
    await SecureStore.setItemAsync(key, value);
  },
};
