import { useSyncExternalStore } from "react";

const browser = typeof window !== "undefined" && typeof window.addEventListener === "function" && typeof navigator !== "undefined" ? window : null;

const subscribe = (notify: () => void) => {
  if (browser === null) return () => undefined;
  browser.addEventListener("online", notify);
  browser.addEventListener("offline", notify);
  return () => {
    browser.removeEventListener("online", notify);
    browser.removeEventListener("offline", notify);
  };
};

const browserOnline = () => browser === null || navigator.onLine !== false;

export function useBrowserOnline() {
  return useSyncExternalStore(subscribe, browserOnline, () => true);
}
