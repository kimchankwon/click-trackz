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
  if (claim.exchange) writePendingGoogleSignIn(claim.pending);
  return claim.exchange;
}

export function writePendingGoogleSignIn(pending: PendingGoogleSignIn | null) {
  try {
    if (pending === null) storage()?.removeItem(KEY);
    else storage()?.setItem(KEY, JSON.stringify(pending));
  } catch {
    return;
  }
}
