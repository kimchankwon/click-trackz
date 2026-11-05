export type PendingGoogleSignIn = { startedAt: number; retried: boolean };

export type GoogleReturnAction = "none" | "clear" | "retry" | "explain";

const PENDING_FOR_MS = 10 * 60_000;

export function googleReturnAction({
  pending,
  now,
  isAuthenticated,
  hasCode,
}: {
  pending: PendingGoogleSignIn | null;
  now: number;
  isAuthenticated: boolean;
  hasCode: boolean;
}): GoogleReturnAction {
  if (pending === null) return "none";
  if (isAuthenticated || now - pending.startedAt > PENDING_FOR_MS) return "clear";
  if (hasCode) return "none";
  return pending.retried ? "explain" : "retry";
}
