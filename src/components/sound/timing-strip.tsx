import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming } from "react-native-reanimated";

import { ThemedText } from "@/components/themed-text";
import { Radius, Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { stripPosition } from "@/lib/timing-strip";

export type TimingLane = { label: string; marks: readonly number[]; tone: "accent" | "text" | "muted"; dots?: boolean };

const LABEL_WIDTH = 84;

export function TimingStrip({ lanes, rangeMs, summary, testID }: { lanes: readonly TimingLane[]; rangeMs: number; summary: string; testID?: string }) {
  const theme = useTheme();
  const toneColor = { accent: theme.accent, text: theme.text, muted: theme.textSecondary };
  return (
    <View style={styles.strip} accessible role="img" aria-label={summary} testID={testID}>
      {lanes.map((lane) => (
        <View key={lane.label} style={styles.lane}>
          <ThemedText type="caption" themeColor="textSecondary" numberOfLines={1} style={styles.label}>
            {lane.label}
          </ThemedText>
          <View style={[styles.track, { backgroundColor: theme.backgroundSelected }]}>
            <View style={[styles.beatLine, { backgroundColor: theme.textTertiary }]} />
            {lane.marks.map((ms, index) => (
              <View
                key={index}
                style={[
                  lane.dots ? styles.dot : styles.mark,
                  { left: `${stripPosition(ms, rangeMs) * 100}%`, backgroundColor: toneColor[lane.tone] },
                  lane.dots ? { opacity: 0.75 } : null,
                ]}
              />
            ))}
          </View>
        </View>
      ))}
      <View style={styles.lane}>
        <View style={styles.label} />
        <View style={styles.axis}>
          <ThemedText type="caption" themeColor="textTertiary" style={styles.tabular}>
            {`${rangeMs} ms early`}
          </ThemedText>
          <ThemedText type="caption" themeColor="textTertiary">
            beat
          </ThemedText>
          <ThemedText type="caption" themeColor="textTertiary" style={styles.tabular}>
            {`${rangeMs} ms late`}
          </ThemedText>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  strip: { gap: Spacing.two },
  lane: { flexDirection: "row", alignItems: "center", gap: Spacing.two },
  label: { width: LABEL_WIDTH },
  track: { flex: 1, height: 24, borderRadius: Radius.sm, overflow: "hidden" },
  beatLine: { position: "absolute", left: "50%", top: 0, bottom: 0, width: 1, marginLeft: -0.5 },
  mark: { position: "absolute", top: 3, bottom: 3, width: 4, marginLeft: -2, borderRadius: 2 },
  dot: { position: "absolute", top: 8, width: 8, height: 8, marginLeft: -4, borderRadius: 4 },
  axis: { flex: 1, flexDirection: "row", justifyContent: "space-between" },
  tabular: { fontVariant: ["tabular-nums"] },
  trackRow: { flexDirection: "row", gap: Spacing.two },
  trackLabels: { width: LABEL_WIDTH, gap: Spacing.two },
  trackLabel: { height: 24, lineHeight: 24 },
  trackLanes: { flex: 1, gap: Spacing.two },
  litMark: { transform: [{ scaleX: 2 }] },
  playhead: { position: "absolute", top: -4, bottom: -4, width: 2, marginLeft: -1, borderRadius: 1 },
});

export type TrackLane = { label: string; offsetMs: number; tone: "accent" | "text" | "muted" };

export function BeatTrack({
  beats,
  intervalMs,
  lanes,
  lit,
  firstBeatAt,
  running,
  testID,
}: {
  beats: number;
  intervalMs: number;
  lanes: readonly TrackLane[];
  lit: number | null;
  firstBeatAt: number | null;
  running: boolean;
  testID?: string;
}) {
  const theme = useTheme();
  const progress = useSharedValue(0);
  const toneColor = { accent: theme.accent, text: theme.text, muted: theme.textSecondary };
  const spanMs = beats * intervalMs;
  const at = (index: number, offsetMs: number) => `${Math.min(100, Math.max(0, (((index + 0.5) * intervalMs + offsetMs) / spanMs) * 100))}%` as const;
  useEffect(() => {
    if (firstBeatAt === null) return;
    const startIn = Math.max(0, firstBeatAt - intervalMs / 2 - performance.now());
    progress.value = 0;
    progress.value = withDelay(startIn, withTiming(1, { duration: spanMs, easing: Easing.linear }));
  }, [firstBeatAt, intervalMs, spanMs, progress]);
  const playhead = useAnimatedStyle(() => ({ left: `${progress.value * 100}%` }));
  return (
    <View style={styles.trackRow} testID={testID} aria-hidden>
      <View style={styles.trackLabels}>
        {lanes.map((lane) => (
          <ThemedText key={lane.label} type="caption" themeColor="textSecondary" numberOfLines={1} style={styles.trackLabel}>
            {lane.label}
          </ThemedText>
        ))}
      </View>
      <View style={styles.trackLanes}>
        {lanes.map((lane) => (
          <View key={lane.label} style={[styles.track, { backgroundColor: theme.backgroundSelected }]}>
            {Array.from({ length: beats }, (_, index) => (
              <View
                key={index}
                style={[
                  styles.mark,
                  { left: at(index, lane.offsetMs), backgroundColor: toneColor[lane.tone] },
                  index === lit ? styles.litMark : null,
                ]}
              />
            ))}
          </View>
        ))}
        {running ? <Animated.View style={[styles.playhead, { backgroundColor: theme.accent }, playhead]} /> : null}
      </View>
    </View>
  );
}
