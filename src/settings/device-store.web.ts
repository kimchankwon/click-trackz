import { notifyDeviceSetting } from "./device-setting-events";

export const deviceStore = {
  get: async (key: string): Promise<string | null> => {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set: async (key: string, value: string): Promise<void> => {
    notifyDeviceSetting(key, value);
    window.localStorage.setItem(key, value);
  },
};
