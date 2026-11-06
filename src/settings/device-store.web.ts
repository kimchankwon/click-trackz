import { notifyDeviceSetting } from "./device-setting-events";

const readLocal = (key: string): string | null => {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};

export const deviceStore = {
  get: async (key: string): Promise<string | null> => readLocal(key),
  getSync: readLocal,
  set: async (key: string, value: string): Promise<void> => {
    notifyDeviceSetting(key, value);
    window.localStorage.setItem(key, value);
  },
};
