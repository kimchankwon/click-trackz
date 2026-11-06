export type PendingGoogleSignIn = { startedAt: number; retried: boolean; codeClaimed?: boolean };

export type GoogleReturnAction = "none" | "clear" | "retry" | "explain";

export type ReturnedCodeClaim = { exchange: true; pending: PendingGoogleSignIn } | { exchange: false };

const PENDING_FOR_MS = 10 * 60_000;

export function googleReturnAction({
  pending,
  now,
  isAuthenticated,
}: {
  pending: PendingGoogleSignIn | null;
  now: number;
  isAuthenticated: boolean;
}): GoogleReturnAction {
  if (pending === null) return "none";
  if (isAuthenticated || now - pending.startedAt > PENDING_FOR_MS) return "clear";
  return pending.retried ? "explain" : "retry";
}

export function claimReturnedCode(pending: PendingGoogleSignIn | null): ReturnedCodeClaim {
  if (pending === null || pending.codeClaimed === true) return { exchange: false };
  return { exchange: true, pending: { ...pending, codeClaimed: true } };
}
