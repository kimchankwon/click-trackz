export const HEARTBEAT_MS = 15_000;
export const ONLINE_WITHIN_MS = 40_000;

export type PresenceRow = { userId: string; onPlay: boolean; seenAt: number };

export type MemberPresence = "onPlay" | "online" | "offline";

const fresh = (rows: readonly PresenceRow[], nowMs: number) => rows.filter((r) => nowMs - r.seenAt <= ONLINE_WITHIN_MS);

export function presenceOf(rows: readonly PresenceRow[], userId: string, nowMs: number): MemberPresence {
  const screens = fresh(rows, nowMs).filter((r) => r.userId === userId);
  if (screens.length === 0) return "offline";
  return screens.some((r) => r.onPlay) ? "onPlay" : "online";
}

export function memberPresence(rows: readonly PresenceRow[], userId: string, nowMs: number, viewerId: string | undefined): MemberPresence {
  const status = presenceOf(rows, userId, nowMs);
  return userId === viewerId && status === "offline" ? "online" : status;
}

export const countOnPlay = (rows: readonly PresenceRow[], nowMs: number) =>
  new Set(fresh(rows, nowMs).filter((r) => r.onPlay).map((r) => r.userId)).size;
