import { useMutation, useQuery } from "convex/react";
import { useIsFocused } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { AppState } from "react-native";

import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { HEARTBEAT_MS, type PresenceRow } from "./online";

const REFRESH_MS = 5_000;

const newScreenId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;

export function useHeartbeat(groupId: Id<"groups">, onPlay: boolean) {
  const heartbeat = useMutation(api.presence.heartbeat);
  const leave = useMutation(api.presence.leave);
  const [screenId] = useState(newScreenId);
  const focused = useIsFocused();
  const [active, setActive] = useState(AppState.currentState === "active");
  const visible = focused && active;
  const onPlayRef = useRef(onPlay);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => setActive(state === "active"));
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    onPlayRef.current = onPlay;
    if (visible) void heartbeat({ groupId, screenId, onPlay }).catch(() => undefined);
  }, [groupId, screenId, onPlay, visible, heartbeat]);

  useEffect(() => {
    if (!visible) return;
    const timer = setInterval(() => void heartbeat({ groupId, screenId, onPlay: onPlayRef.current }).catch(() => undefined), HEARTBEAT_MS);
    return () => {
      clearInterval(timer);
      void leave({ groupId, screenId }).catch(() => undefined);
    };
  }, [groupId, screenId, visible, heartbeat, leave]);
}

export function usePresence(groupId: Id<"groups">, serverNow: () => number | null) {
  const rows = useQuery(api.presence.list, { groupId });
  const [nowMs, setNowMs] = useState(() => serverNow() ?? Date.now());

  useEffect(() => {
    const refresh = () => setNowMs(serverNow() ?? Date.now());
    refresh();
    const timer = setInterval(refresh, REFRESH_MS);
    return () => clearInterval(timer);
  }, [serverNow, rows]);

  return { rows: (rows ?? []) as PresenceRow[], nowMs };
}
