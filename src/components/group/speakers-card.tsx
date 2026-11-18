import { useMutation, useQuery } from "convex/react";
import { useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";

import { ActionButton } from "@/components/action-button";
import { Card, Divider } from "@/components/group/card";
import { SpeakerStrip, type SpeakerLane } from "@/components/group/speaker-strip";
import { ThemedText } from "@/components/themed-text";
import { Spacing } from "@/constants/theme";
import { errorText } from "@/lib/error-text";
import { ONLINE_WITHIN_MS } from "@/presence/online";
import { clampLatency, nudgeFromShown, nudgeShown, nudgeText } from "@/settings/latency";
import { playsInSpeakerCheck, SPEAKER_CHECK_BPM, type SpeakerCheck } from "@/sync/speaker-check";
import { useServerBeatPhase } from "@/sync/use-server-beat-phase";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

const STEPS = [-10, -1, 1, 10] as const;
const SEND_EVERY_MS = 120;
const CHECK_BEAT_MS = 60_000 / SPEAKER_CHECK_BPM;

type ShownCheck = SpeakerCheck & { listenToName: string | null };

type DeviceRow = {
  deviceId: string;
  name: string;
  label: string;
  nudgeMs: number;
  sending: boolean;
  mine: boolean;
};

type Outgoing = { value: number; timer: ReturnType<typeof setTimeout> | null };

const stepLabel = (step: number) => (step > 0 ? `+${step}` : `−${-step}`);

const joinNames = (names: readonly string[]) => (names.length <= 1 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`);

function laneLabels(rows: readonly DeviceRow[]) {
  const seen = new Map<string, number>();
  return rows.map((row) => {
    const count = (seen.get(row.name) ?? 0) + 1;
    seen.set(row.name, count);
    return count === 1 ? row.name : `${row.name} ${count}`;
  });
}

export function SpeakersCard({
  groupId,
  nowMs,
  serverNow,
  myDeviceId,
  myName,
  myLabel,
  myNudgeMs,
  setMyNudge,
  check,
  checkLive,
  groupPlaying,
  playingOffline,
  locked,
}: {
  groupId: Id<"groups">;
  nowMs: number;
  serverNow: () => number | null;
  myDeviceId: string;
  myName: string;
  myLabel: string;
  myNudgeMs: number;
  setMyNudge: (nudgeMs: number) => Promise<boolean>;
  check: ShownCheck | null;
  checkLive: boolean;
  groupPlaying: boolean;
  playingOffline: boolean;
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
  const outgoing = useRef(new Map<string, Outgoing>());
  const phase = useServerBeatPhase(checkLive && check ? check.startsAt : null, CHECK_BEAT_MS, serverNow);

  useEffect(() => {
    const pending = outgoing.current;
    return () => pending.forEach((slot) => (slot.timer ? clearTimeout(slot.timer) : undefined));
  }, []);

  const online = (shown?.devices ?? []).filter((device) => device.deviceId !== myDeviceId && nowMs - device.seenAt <= ONLINE_WITHIN_MS);
  const rows: DeviceRow[] = [
    { deviceId: myDeviceId, name: myName, label: `${myLabel}, this device`, nudgeMs: targets[myDeviceId] ?? myNudgeMs, sending: false, mine: true },
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
  const labels = laneLabels(rows);
  const lanes: SpeakerLane[] = rows.map((row, index) => ({
    deviceId: row.deviceId,
    label: labels[index],
    nudgeMs: row.nudgeMs,
    playing: checkLive && check !== null && playsInSpeakerCheck(check, row.deviceId),
  }));
  const olderApps = (shown?.olderApps ?? []).filter((member) => nowMs - member.seenAt <= ONLINE_WITHIN_MS).map((member) => member.displayName);
  const listenTo = checkLive ? (check?.listenTo ?? null) : null;
  const comparingHere = check?.comparedWith === myDeviceId;

  const settle = (deviceId: string, value: number) => {
    if (outgoing.current.get(deviceId)?.timer) return;
    setTargets((current) => {
      if (current[deviceId] !== value) return current;
      const rest = { ...current };
      delete rest[deviceId];
      return rest;
    });
  };

  const deliver = (deviceId: string, value: number) => {
    if (deviceId === myDeviceId) {
      void setMyNudge(value).then((saved) => {
        settle(deviceId, value);
        if (!saved) setProblem("This device could not save its Latency nudge, so it went back to the last saved value. Try again.");
      });
      return;
    }
    nudgeDevice({ groupId, deviceId, nudgeMs: value }).then(
      () => settle(deviceId, value),
      (error: unknown) => {
        settle(deviceId, value);
        setProblem(errorText(error));
      },
    );
  };

  const queueNudge = (deviceId: string, value: number) => {
    const next = clampLatency(value);
    setProblem(null);
    setTargets((current) => (current[deviceId] === next ? current : { ...current, [deviceId]: next }));
    const slot = outgoing.current.get(deviceId) ?? { value: next, timer: null };
    slot.value = next;
    outgoing.current.set(deviceId, slot);
    if (slot.timer) return;
    slot.timer = setTimeout(() => {
      slot.timer = null;
      deliver(deviceId, slot.value);
    }, SEND_EVERY_MS);
  };

  const flushNudge = (deviceId: string) => {
    const slot = outgoing.current.get(deviceId);
    if (!slot?.timer) return;
    clearTimeout(slot.timer);
    slot.timer = null;
    deliver(deviceId, slot.value);
  };

  const stepNudge = (row: DeviceRow, step: number) => {
    queueNudge(row.deviceId, nudgeFromShown(nudgeShown(row.nudgeMs) + step));
    flushNudge(row.deviceId);
  };

  const toggleCheck = () => {
    setProblem(null);
    const pressedAt = serverNow();
    if (!checkLive && pressedAt === null) {
      setProblem("This device is still measuring the clock. Try again in a moment.");
      return;
    }
    setCheckPending(true);
    const action = checkLive || pressedAt === null ? stopCheck({ groupId }) : startCheck({ groupId, deviceId: myDeviceId, pressedAt });
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
    const stopListening = listenTo === row.deviceId && comparingHere;
    listen({ groupId, deviceId: stopListening ? null : row.deviceId, fromDeviceId: myDeviceId }).catch((error: unknown) => setProblem(errorText(error)));
  };

  return (
    <Card title="Align across devices">
      <ThemedText type="small" themeColor="textSecondary">
        Play a click on every device in the Group, then drag or nudge each one until its click lands with this device.
      </ThemedText>
      <ActionButton
        full
        accent={!checkLive}
        icon={checkLive ? "stop" : "play"}
        label={checkLive ? "Stop check" : "Play check"}
        testID="check-toggle"
        pending={checkPending}
        disabled={!checkLive && (locked || groupPlaying || playingOffline)}
        onPress={toggleCheck}
      />
      {!checkLive && (groupPlaying || playingOffline) ? (
        <ThemedText type="caption" themeColor="textSecondary" testID="check-blocked">
          {groupPlaying ? "Stop the Playback to play a check" : "Set Play mode to With the Group to play a check on this device"}
        </ThemedText>
      ) : null}
      {checkLive && playingOffline ? (
        <ThemedText type="caption" themeColor="textSecondary" testID="check-offline">
          This device is in Offline play, so it stays quiet. Set Play mode to With the Group to hear the check here
        </ThemedText>
      ) : null}
      {checkLive ? (
        <ThemedText type="caption" themeColor="textSecondary" testID="check-who" role="status" aria-live="polite">
          {listenTo === null
            ? "Every device clicks once a second. Press Listen to hear one device with yours"
            : comparingHere
              ? `Only ${check?.listenToName ?? "one device"} and this device click`
              : `Listening to ${check?.listenToName ?? "one device"}`}
        </ThemedText>
      ) : null}
      <SpeakerStrip lanes={lanes} phase={phase} live={checkLive} onNudge={queueNudge} onRelease={flushNudge} />
      {rows.map((row, index) => (
        <View key={row.deviceId} style={styles.device} testID={`device-${row.deviceId}`}>
          {index > 0 ? <Divider /> : null}
          <View style={styles.heading}>
            <View style={styles.grow}>
              <ThemedText type="smallBold" numberOfLines={1}>
                {labels[index]}
              </ThemedText>
              <ThemedText type="caption" themeColor="textSecondary" numberOfLines={1}>
                {row.label}
              </ThemedText>
            </View>
            <View style={styles.value}>
              <ThemedText type="smallBold" testID={`device-nudge-${row.deviceId}`}>{nudgeText(row.nudgeMs)}</ThemedText>
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
                  accessibleName={`${stepLabel(step)} ms for ${labels[index]}, ${row.label}`}
                  testID={`device-${row.deviceId}-${step}`}
                  onPress={() => stepNudge(row, step)}
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
                  label={listenTo === row.deviceId && comparingHere ? "All" : "Listen"}
                  accessibleName={listenTo === row.deviceId && comparingHere ? "Hear every device again" : `Listen to ${labels[index]}, ${row.label}, with this device`}
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
