export const REACTIONS = ["👏", "🔥", "❤️", "👍", "🙌", "😂"] as const;

export type Reaction = (typeof REACTIONS)[number];

export const isReaction = (value: string): value is Reaction => REACTIONS.some((reaction) => reaction === value);

export const MAX_COMMENT_LENGTH = 200;
export const COMMENT_BUBBLE_MS = 10_000;
export const REACTION_FLOAT_MS = 3_000;
export const COMMENT_GAP_MS = 1_000;
export const REACTION_GAP_MS = 250;

export const cleanComment = (text: string) => text.replace(/\s+/g, " ").trim();

export type Said = { userId: string; text: string; at: number };

export function bubblesAt(comments: readonly Said[], nowMs: number): Map<string, Said> {
  const bubbles = new Map<string, Said>();
  for (const comment of comments) {
    const age = nowMs - comment.at;
    if (age < 0 || age >= COMMENT_BUBBLE_MS) continue;
    const shown = bubbles.get(comment.userId);
    if (shown === undefined || shown.at < comment.at) bubbles.set(comment.userId, comment);
  }
  return bubbles;
}

export function nextBubbleChangeIn(comments: readonly Said[], nowMs: number): number | null {
  const endings = comments.map((comment) => comment.at + COMMENT_BUBBLE_MS - nowMs).filter((ms) => ms > 0);
  return endings.length === 0 ? null : Math.min(...endings);
}

export const isFloating = (at: number, nowMs: number) => nowMs - at >= -REACTION_FLOAT_MS && nowMs - at < REACTION_FLOAT_MS;
