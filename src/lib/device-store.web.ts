export async function readDeviceValue(name: string): Promise<string | null> {
  try {
    return window.localStorage.getItem(name);
  } catch {
    return null;
  }
}

export async function writeDeviceValue(name: string, json: string): Promise<void> {
  window.localStorage.setItem(name, json);
}

export async function clearDeviceValue(name: string): Promise<void> {
  try {
    window.localStorage.removeItem(name);
  } catch {
    return;
  }
}
