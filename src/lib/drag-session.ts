export const HOLD_MS = 350;
export const HOLD_SLOP = 6;

export type Hold = { x: number; y: number; heldFrom: number; drift: number };

export type HoldDecision = "wait" | "activate" | "fail";

export const startHold = (x: number, y: number, heldFrom: number): Hold => ({ x, y, heldFrom, drift: 0 });

export const moveHold = (hold: Hold, x: number, y: number): Hold => ({ ...hold, drift: Math.max(hold.drift, Math.hypot(x - hold.x, y - hold.y)) });

export function holdDecision(hold: Hold, now: number, rowShift = 0): HoldDecision {
  if (hold.drift > HOLD_SLOP || Math.abs(rowShift) > HOLD_SLOP) return "fail";
  return now - hold.heldFrom >= HOLD_MS ? "activate" : "wait";
}

export type DragOwner = "handle" | "hold";

export type DragSession = { key: string; owner: DragOwner; from: number; to: number; order: string };

export type DragEnd = { kind: "ignore" } | { kind: "none" } | { kind: "stale" } | { kind: "move"; from: number; to: number };

const orderKeyOf = (order: readonly string[]) => order.join("|");

export function beginDrag(session: DragSession | null, key: string, owner: DragOwner, order: readonly string[], allowed: boolean): DragSession | null {
  if (session !== null || !allowed) return null;
  const from = order.indexOf(key);
  if (from < 0) return null;
  return { key, owner, from, to: from, order: orderKeyOf(order) };
}

export const ownsDrag = (session: DragSession | null, key: string, owner: DragOwner): session is DragSession =>
  session !== null && session.key === key && session.owner === owner;

export function endDrag(session: DragSession | null, key: string, owner: DragOwner, canceled: boolean, order: readonly string[]): DragEnd {
  if (!ownsDrag(session, key, owner)) return { kind: "ignore" };
  if (canceled || session.to === session.from) return { kind: "none" };
  if (orderKeyOf(order) !== session.order) return { kind: "stale" };
  return { kind: "move", from: session.from, to: session.to };
}
