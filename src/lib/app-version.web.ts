import { entryScriptIn } from "./stale-app";

const RELOADED_AT_KEY = "click-trackz:stale-reload-at";
const RELOAD_AGAIN_AFTER_MS = 60_000;

const runningEntry = () =>
  [...document.querySelectorAll("script[src]")].map((script) => entryScriptIn(script.getAttribute("src") ?? "")).find((entry) => entry !== null) ?? null;

export async function newerVersionIsLive(): Promise<boolean> {
  const running = runningEntry();
  if (running === null) return false;
  try {
    const response = await fetch("/", { cache: "no-store" });
    if (!response.ok) return false;
    const live = entryScriptIn(await response.text());
    return live !== null && live !== running;
  } catch {
    return false;
  }
}

export function reloadApp() {
  window.location.reload();
}

export function canReloadForStaleApp(): boolean {
  try {
    return Date.now() - Number(window.sessionStorage.getItem(RELOADED_AT_KEY) ?? 0) >= RELOAD_AGAIN_AFTER_MS;
  } catch {
    return false;
  }
}

export function reloadForStaleApp() {
  try {
    window.sessionStorage.setItem(RELOADED_AT_KEY, String(Date.now()));
  } catch {
    return;
  }
  reloadApp();
}
