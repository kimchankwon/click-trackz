import * as SecureStore from "expo-secure-store";

import { notifyDeviceSetting } from "./device-setting-events";

export const deviceStore = {
  get: (key: string) => SecureStore.getItemAsync(key),
  set: async (key: string, value: string) => {
    notifyDeviceSetting(key, value);
    await SecureStore.setItemAsync(key, value);
  },
};
