import { useMutation, useQuery } from "convex/react";
import { useIsFocused } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";

import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { HEARTBEAT_MS, type PresenceRow } from "./online";

const REFRESH_MS = 5_000;

const newScreenId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;

export function useHeartbeat(groupId: Id<"groups">, onPlay: boolean, playing = false, shared = true) {
  const heartbeat = useMutation(api.presence.heartbeat);
  const leave = useMutation(api.presence.leave);
  const [screenId] = useState(newScreenId);
  const focused = useIsFocused();
  const [active, setActive] = useState(AppState.currentState === "active");
  const visible = shared && focused && (active || playing);
  const onPlayRef = useRef(onPlay);
  const pingRef = useRef<number | null>(null);
  const visibleRef = useRef(visible);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => setActive(state === "active"));
    return () => subscription.remove();
  }, []);

  const beat = useCallback(
    (onPlayNow: boolean) => {
      const sentAt = performance.now();
      void heartbeat({ groupId, screenId, onPlay: onPlayNow, roundTripMs: pingRef.current ?? undefined }).then(
        () => {
          const firstPing = pingRef.current === null;
          pingRef.current = performance.now() - sentAt;
          if (firstPing && visibleRef.current) {
            void heartbeat({ groupId, screenId, onPlay: onPlayRef.current, roundTripMs: pingRef.current }).catch(() => undefined);
          }
        },
        () => undefined,
      );
    },
    [groupId, screenId, heartbeat],
  );

  useEffect(() => {
    visibleRef.current = visible;
    onPlayRef.current = onPlay;
    if (visible) beat(onPlay);
  }, [onPlay, visible, beat]);

  useEffect(() => {
    if (!visible) return;
    const timer = setInterval(() => beat(onPlayRef.current), HEARTBEAT_MS);
    return () => {
      visibleRef.current = false;
      clearInterval(timer);
      void leave({ groupId, screenId }).catch(() => undefined);
    };
  }, [groupId, screenId, visible, beat, leave]);
}

export function usePresence(groupId: Id<"groups">, serverNow: () => number | null, shared = true) {
  const rows = useQuery(api.presence.list, shared ? { groupId } : "skip");
  const [nowMs, setNowMs] = useState(() => serverNow() ?? Date.now());

  useEffect(() => {
    const refresh = () => setNowMs(serverNow() ?? Date.now());
    refresh();
    const timer = setInterval(refresh, REFRESH_MS);
    return () => clearInterval(timer);
  }, [serverNow, rows]);

  return { rows: (rows ?? []) as PresenceRow[], nowMs };
}
