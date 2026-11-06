import { Platform } from "react-native";

import { claimReturnedCode, type PendingGoogleSignIn } from "./google-return";

const KEY = "clickTrackz.pendingGoogleSignIn";

const storage = () => {
  if (Platform.OS !== "web") return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
};

export function readPendingGoogleSignIn(): PendingGoogleSignIn | null {
  try {
    const raw = storage()?.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PendingGoogleSignIn>;
    return typeof parsed.startedAt === "number"
      ? { startedAt: parsed.startedAt, retried: parsed.retried === true, codeClaimed: parsed.codeClaimed === true }
      : null;
  } catch {
    return null;
  }
}

export function claimReturnedGoogleCode(): boolean {
  if (storage() === null) return true;
  const claim = claimReturnedCode(readPendingGoogleSignIn());
  return claim.exchange && writePendingGoogleSignIn(claim.pending);
}

export function writePendingGoogleSignIn(pending: PendingGoogleSignIn | null): boolean {
  try {
    const store = storage();
    if (store === null) return false;
    if (pending === null) store.removeItem(KEY);
    else store.setItem(KEY, JSON.stringify(pending));
    return true;
  } catch {
    return false;
  }
}
