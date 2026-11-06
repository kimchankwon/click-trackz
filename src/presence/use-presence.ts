import { useMutation, useQuery } from "convex/react";
import { useEffect, useState } from "react";
import { AppState } from "react-native";

import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { HEARTBEAT_MS, type PresenceRow } from "./online";

const REFRESH_MS = 5_000;

export function useHeartbeat(groupId: Id<"groups">, onPlay: boolean) {
  const heartbeat = useMutation(api.presence.heartbeat);
  const leave = useMutation(api.presence.leave);
  const [active, setActive] = useState(AppState.currentState === "active");

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => setActive(state === "active"));
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!active) {
      void leave({ groupId }).catch(() => undefined);
      return;
    }
    const beat = () => void heartbeat({ groupId, onPlay }).catch(() => undefined);
    beat();
    const timer = setInterval(beat, HEARTBEAT_MS);
    return () => clearInterval(timer);
  }, [groupId, onPlay, active, heartbeat, leave]);

  useEffect(() => () => void leave({ groupId }).catch(() => undefined), [groupId, leave]);
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
