import { useMutation, useQuery } from "convex/react";
import { useIsFocused } from "expo-router";
import { useCallback, useEffect, useEffectEvent, useRef, useState } from "react";
import { AppState } from "react-native";

import { currentAudioOutput } from "@/audio/audio-output";
import { useAppActive } from "@/lib/use-app-active";
import { deviceId } from "@/settings/device-id";
import { deviceLabel } from "@/settings/device-label";
import { clampLatency } from "@/settings/latency";
import { saveLatencyNudgeForOutput } from "@/settings/use-latency-nudge";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { HEARTBEAT_MS, type PresenceRow } from "./online";

const REFRESH_MS = 5_000;
const ANNOUNCE_AFTER_MS = 600;
const ROUND_TRIP_CHANGE_MS = 100;

const newScreenId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;

export function useHeartbeat(groupId: Id<"groups">, onPlay: boolean, playing = false, shared = true, nudgeMs: number | null = null, outputName: string | null = null) {
  const heartbeat = useMutation(api.presence.heartbeat);
  const leave = useMutation(api.presence.leave);
  const [screenId] = useState(newScreenId);
  const [device] = useState(() => ({ id: deviceId(), label: deviceLabel() }));
  const nudgeRef = useRef(nudgeMs);
  const outputRef = useRef(outputName);
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
      const send = (onPlaySent: boolean, followUp: boolean) => {
        const sentAt = performance.now();
        const reported = pingRef.current;
        void heartbeat({
          groupId,
          screenId,
          onPlay: onPlaySent,
          roundTripMs: reported ?? undefined,
          deviceId: device.id,
          deviceLabel: device.label,
          nudgeMs: nudgeRef.current ?? undefined,
          outputName: outputRef.current ?? "",
        }).then(
          () => {
            const measured = performance.now() - sentAt;
            pingRef.current = measured;
            const changed = reported === null || Math.abs(measured - reported) >= ROUND_TRIP_CHANGE_MS;
            if (!followUp && changed && visibleRef.current) send(onPlayRef.current, true);
          },
          () => undefined,
        );
      };
      send(onPlayNow, false);
    },
    [groupId, screenId, device, heartbeat],
  );

  useEffect(() => {
    visibleRef.current = visible;
    onPlayRef.current = onPlay;
    nudgeRef.current = nudgeMs;
    outputRef.current = outputName;
    if (visible) beat(onPlay);
  }, [onPlay, visible, beat, nudgeMs, outputName]);

  useEffect(() => {
    if (!visible) return;
    const timer = setInterval(() => beat(onPlayRef.current), HEARTBEAT_MS);
    return () => {
      visibleRef.current = false;
      clearInterval(timer);
      void leave({ groupId, screenId }).catch(() => undefined);
    };
  }, [groupId, screenId, visible, beat, leave]);

  return { screenId, deviceId: device.id };
}

export function useNudgesFromManagers(
  groupId: Id<"groups">,
  screenId: string,
  shared: boolean,
  onNudged: (byName: string, nudgeMs: number) => void,
  onNotSaved: (byName: string) => void,
) {
  const request = useQuery(api.presence.myNudgeRequest, shared ? { groupId, screenId } : "skip");
  const applied = useMutation(api.presence.nudgeApplied);
  const handled = useRef<string | null>(null);
  const latestApply = useRef(0);
  const announce = useEffectEvent(onNudged);
  const reportNotSaved = useEffectEvent(onNotSaved);
  const announceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (announceTimer.current) clearTimeout(announceTimer.current);
    },
    [],
  );

  useEffect(() => {
    if (!request || handled.current === request.id) return;
    handled.current = request.id;
    const nudgeMs = clampLatency(request.ms);
    const { id, byName } = request;
    const apply = ++latestApply.current;
    const output = currentAudioOutput();
    void saveLatencyNudgeForOutput(nudgeMs, output).then((saved) => {
      if (saved) {
        if (announceTimer.current) clearTimeout(announceTimer.current);
        announceTimer.current = setTimeout(() => announce(byName, nudgeMs), ANNOUNCE_AFTER_MS);
        const stillPlayingThere = currentAudioOutput()?.id === output?.id;
        applied({ groupId, screenId, id, ...(stillPlayingThere ? { nudgeMs } : {}) }).catch(() => {
          if (handled.current === id) handled.current = null;
        });
        return;
      }
      if (handled.current === id) handled.current = null;
      if (apply === latestApply.current) reportNotSaved(byName);
    });
  }, [request, groupId, screenId, applied]);
}

const STILL_HERE_MS = 20 * 60_000;

export function useStillHere(groupId: Id<"groups">, enabled: boolean) {
  const stillHere = useMutation(api.presence.stillHere);

  useEffect(() => {
    if (!enabled) return;
    const timer = setInterval(() => void stillHere({ groupId }).catch(() => undefined), STILL_HERE_MS);
    return () => clearInterval(timer);
  }, [groupId, enabled, stillHere]);
}

export function useGuestStaysWhileEditing(groupId: Id<"groups">) {
  const viewer = useQuery(api.users.viewer, {});
  const stillHere = useMutation(api.presence.stillHere);
  const focused = useIsFocused();
  const active = useAppActive();
  const marking = viewer?.isAnonymous === true && focused && active;

  useEffect(() => {
    if (!marking) return;
    const mark = () => void stillHere({ groupId }).catch(() => undefined);
    mark();
    const timer = setInterval(mark, STILL_HERE_MS);
    return () => clearInterval(timer);
  }, [groupId, marking, stillHere]);
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
