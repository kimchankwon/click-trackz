export const HEARTBEAT_MS = 15_000;
export const ONLINE_WITHIN_MS = 40_000;

export type PresenceRow = { userId: string; onPlay: boolean; seenAt: number };

export type MemberPresence = "onPlay" | "online" | "offline";

export function presenceOf(rows: readonly PresenceRow[], userId: string, nowMs: number): MemberPresence {
  const row = rows.find((r) => r.userId === userId);
  if (!row || nowMs - row.seenAt > ONLINE_WITHIN_MS) return "offline";
  return row.onPlay ? "onPlay" : "online";
}

export const countOnPlay = (rows: readonly PresenceRow[], nowMs: number) =>
  rows.filter((r) => r.onPlay && nowMs - r.seenAt <= ONLINE_WITHIN_MS).length;
