import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { bubblesAt, nextBubbleChangeIn, type Reaction } from "@/lib/chat";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

const FIRST_PAGE = 30;
const MORE = 30;

export type ChatEntry = { chatId: string; userId: string; name: string; text: string; at: number };

export type GroupChat = ReturnType<typeof useGroupChat>;

export function useGroupChat(groupId: Id<"groups">, enabled: boolean, serverNow: () => number | null) {
  const { results, status, loadMore } = usePaginatedQuery(api.chat.comments, enabled ? { groupId } : "skip", { initialNumItems: FIRST_PAGE });
  const reactions = useQuery(api.chat.reactions, enabled ? { groupId } : "skip");
  const sendComment = useMutation(api.chat.comment);
  const sendReaction = useMutation(api.chat.react);
  const now = useCallback(() => serverNow() ?? Date.now(), [serverNow]);
  const [nowMs, setNowMs] = useState(() => serverNow() ?? Date.now());
  const comments: ChatEntry[] = useMemo(() => [...results].reverse(), [results]);
  useEffect(() => {
    const timer = setTimeout(() => setNowMs(serverNow() ?? Date.now()), 0);
    return () => clearTimeout(timer);
  }, [results, reactions, serverNow]);
  useEffect(() => {
    const wait = nextBubbleChangeIn(comments, nowMs);
    if (wait === null) return;
    const timer = setTimeout(() => setNowMs(serverNow() ?? Date.now()), wait + 20);
    return () => clearTimeout(timer);
  }, [comments, nowMs, serverNow]);
  return {
    comments,
    reactions: (reactions ?? []) as readonly ChatEntry[],
    bubbles: bubblesAt(comments, nowMs),
    canLoadOlder: status === "CanLoadMore",
    loadingOlder: status === "LoadingMore",
    loaded: status !== "LoadingFirstPage",
    loadOlder: () => loadMore(MORE),
    now,
    comment: (text: string) => sendComment({ groupId, text }),
    react: (reaction: Reaction) => sendReaction({ groupId, reaction }),
  };
}
