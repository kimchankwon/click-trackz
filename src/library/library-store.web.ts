const LIBRARY_KEY = "my-library";

export async function readStoredLibrary(): Promise<string | null> {
  try {
    return window.localStorage.getItem(LIBRARY_KEY);
  } catch {
    return null;
  }
}

export async function writeStoredLibrary(json: string): Promise<void> {
  window.localStorage.setItem(LIBRARY_KEY, json);
}

export async function clearStoredLibrary(): Promise<void> {
  try {
    window.localStorage.removeItem(LIBRARY_KEY);
  } catch {
    return;
  }
}
