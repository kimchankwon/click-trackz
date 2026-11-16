import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { ActionButton } from "@/components/action-button";
import { Card, Divider } from "@/components/group/card";
import { ThemedText } from "@/components/themed-text";
import { Spacing } from "@/constants/theme";
import { errorText } from "@/lib/error-text";
import { ONLINE_WITHIN_MS } from "@/presence/online";
import { clampLatency } from "@/settings/latency";
import type { SpeakerCheck } from "@/sync/speaker-check";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

const STEPS = [-10, -1, 1, 10] as const;

type ShownCheck = SpeakerCheck & { listenToName: string | null };

type DeviceRow = {
  deviceId: string;
  name: string;
  label: string;
  nudgeMs: number;
  sending: boolean;
  mine: boolean;
};

const stepLabel = (step: number) => (step > 0 ? `+${step}` : `−${-step}`);

const joinNames = (names: readonly string[]) => (names.length <= 1 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`);

export function SpeakersCard({
  groupId,
  nowMs,
  myDeviceId,
  myName,
  myLabel,
  myNudgeMs,
  setMyNudge,
  check,
  checkLive,
  groupPlaying,
  locked,
}: {
  groupId: Id<"groups">;
  nowMs: number;
  myDeviceId: string;
  myName: string;
  myLabel: string;
  myNudgeMs: number;
  setMyNudge: (nudgeMs: number) => void;
  check: ShownCheck | null;
  checkLive: boolean;
  groupPlaying: boolean;
  locked: boolean;
}) {
  const shown = useQuery(api.presence.devices, { groupId });
  const nudgeDevice = useMutation(api.presence.nudgeDevice);
  const startCheck = useMutation(api.speakerCheck.start);
  const stopCheck = useMutation(api.speakerCheck.stop);
  const listen = useMutation(api.speakerCheck.listen);
  const [targets, setTargets] = useState<Record<string, number>>({});
  const [problem, setProblem] = useState<string | null>(null);
  const [checkPending, setCheckPending] = useState(false);

  const online = (shown?.devices ?? []).filter((device) => device.deviceId !== myDeviceId && nowMs - device.seenAt <= ONLINE_WITHIN_MS);
  const rows: DeviceRow[] = [
    { deviceId: myDeviceId, name: myName, label: `${myLabel}, this device`, nudgeMs: myNudgeMs, sending: false, mine: true },
    ...online
      .sort((a, b) => a.displayName.localeCompare(b.displayName) || a.deviceLabel.localeCompare(b.deviceLabel))
      .map((device) => ({
        deviceId: device.deviceId,
        name: device.displayName,
        label: device.deviceLabel,
        nudgeMs: targets[device.deviceId] ?? device.pendingMs ?? device.nudgeMs ?? 0,
        sending: targets[device.deviceId] !== undefined || device.pendingMs !== null,
        mine: false,
      })),
  ];
  const olderApps = (shown?.olderApps ?? []).filter((member) => nowMs - member.seenAt <= ONLINE_WITHIN_MS).map((member) => member.displayName);
  const listenTo = checkLive ? (check?.listenTo ?? null) : null;

  const nudge = (row: DeviceRow, step: number) => {
    const next = clampLatency(row.nudgeMs + step);
    if (next === row.nudgeMs) return;
    setProblem(null);
    if (row.mine) {
      setMyNudge(next);
      return;
    }
    setTargets((current) => ({ ...current, [row.deviceId]: next }));
    const settle = () =>
      setTargets((current) => {
        if (current[row.deviceId] !== next) return current;
        const rest = { ...current };
        delete rest[row.deviceId];
        return rest;
      });
    nudgeDevice({ groupId, deviceId: row.deviceId, nudgeMs: next }).then(settle, (error: unknown) => {
      settle();
      setProblem(errorText(error));
    });
  };

  const toggleCheck = () => {
    setProblem(null);
    setCheckPending(true);
    const action = checkLive ? stopCheck({ groupId }) : startCheck({ groupId, deviceId: myDeviceId, pressedAt: Date.now() });
    action.then(
      () => setCheckPending(false),
      (error: unknown) => {
        setCheckPending(false);
        setProblem(errorText(error));
      },
    );
  };

  const toggleListen = (row: DeviceRow) => {
    setProblem(null);
    listen({ groupId, deviceId: listenTo === row.deviceId ? null : row.deviceId }).catch((error: unknown) => setProblem(errorText(error)));
  };

  return (
    <Card title="Line up speakers">
      <ThemedText type="small" themeColor="textSecondary">
        Play a click on every device in the Group, then nudge each one until its click lands with this device.
      </ThemedText>
      <ActionButton
        full
        accent={!checkLive}
        icon={checkLive ? "stop" : "play"}
        label={checkLive ? "Stop check" : "Play check"}
        testID="check-toggle"
        pending={checkPending}
        disabled={!checkLive && (locked || groupPlaying)}
        onPress={toggleCheck}
      />
      {!checkLive && groupPlaying ? (
        <ThemedText type="caption" themeColor="textSecondary" testID="check-blocked">
          Stop the Playback to play a check
        </ThemedText>
      ) : null}
      {checkLive ? (
        <ThemedText type="caption" themeColor="textSecondary" testID="check-who" role="status" aria-live="polite">
          {listenTo === null ? "Every device clicks once a second. Press Listen to hear one device with yours" : `Only ${check?.listenToName ?? "one device"} and this device click`}
        </ThemedText>
      ) : null}
      {rows.map((row, index) => (
        <View key={row.deviceId} style={styles.device} testID={`device-${row.deviceId}`}>
          {index > 0 ? <Divider /> : null}
          <View style={styles.heading}>
            <View style={styles.grow}>
              <ThemedText type="smallBold" numberOfLines={1}>
                {row.name}
              </ThemedText>
              <ThemedText type="caption" themeColor="textSecondary" numberOfLines={1}>
                {row.label}
              </ThemedText>
            </View>
            <View style={styles.value}>
              <ThemedText type="smallBold" testID={`device-nudge-${row.deviceId}`}>{`${row.nudgeMs} ms`}</ThemedText>
              {row.sending ? (
                <ThemedText type="caption" themeColor="textSecondary">
                  Sending
                </ThemedText>
              ) : null}
            </View>
          </View>
          <View style={styles.steps}>
            {STEPS.map((step) => (
              <View key={step} style={styles.stepCell}>
                <ActionButton
                  full
                  small
                  compact
                  label={stepLabel(step)}
                  accessibleName={`${stepLabel(step)} ms for ${row.name}, ${row.label}`}
                  testID={`device-${row.deviceId}-${step}`}
                  onPress={() => nudge(row, step)}
                />
              </View>
            ))}
            {checkLive && !row.mine ? (
              <View style={styles.stepCell}>
                <ActionButton
                  full
                  small
                  compact
                  accent={listenTo === row.deviceId}
                  icon="headphones"
                  label={listenTo === row.deviceId ? "All" : "Listen"}
                  accessibleName={listenTo === row.deviceId ? "Hear every device again" : `Listen to ${row.name}, ${row.label}, with this device`}
                  testID={`device-${row.deviceId}-listen`}
                  onPress={() => toggleListen(row)}
                />
              </View>
            ) : null}
          </View>
        </View>
      ))}
      {rows.length === 1 ? (
        <ThemedText type="caption" themeColor="textSecondary" testID="devices-alone">
          No other device has this Group open
        </ThemedText>
      ) : null}
      {olderApps.length > 0 ? (
        <ThemedText type="caption" themeColor="textSecondary" testID="devices-older-apps">
          {`${joinNames(olderApps)} need${olderApps.length === 1 ? "s" : ""} the latest app before you can nudge them`}
        </ThemedText>
      ) : null}
      {problem ? (
        <ThemedText type="small" themeColor="danger" testID="devices-problem" role="alert">
          {problem}
        </ThemedText>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  device: { gap: Spacing.two },
  heading: { flexDirection: "row", alignItems: "center", gap: Spacing.three },
  grow: { flex: 1 },
  value: { alignItems: "flex-end" },
  steps: { flexDirection: "row", gap: Spacing.two },
  stepCell: { flex: 1, flexDirection: "row" },
});
