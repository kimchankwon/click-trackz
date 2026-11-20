import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from "react-native-reanimated";

import { ThemedText } from "@/components/themed-text";
import { Radius, Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { markGrowth } from "@/lib/timing-test";
import { stripPosition } from "@/lib/timing-strip";

type TimingLane = { label: string; marks: readonly number[]; tone: "accent" | "text" | "muted"; dots?: boolean };

const LABEL_WIDTH = 84;
const LANE_HEIGHT = 28;
const MARK_SLIDE_MS = 160;

function Mark({ position, color, dot, phase }: { position: number; color: string; dot: boolean; phase: SharedValue<number> }) {
  const at = useSharedValue(position);
  useEffect(() => {
    at.set(withTiming(position, { duration: MARK_SLIDE_MS, easing: Easing.out(Easing.cubic) }));
  }, [at, position]);
  const placed = useAnimatedStyle(() => {
    const now = at.get();
    const amount = dot ? 0 : markGrowth(phase.get(), now);
    return { left: `${now * 100}%`, transform: [{ scaleX: 1 + amount * 1.5 }, { scaleY: 1 + amount * 0.25 }] };
  });
  return <Animated.View style={[dot ? styles.dot : styles.mark, { backgroundColor: color }, dot ? styles.dotFade : null, placed]} />;
}

export function TimingStrip({
  lanes,
  rangeMs,
  summary,
  phase,
  testID,
}: {
  lanes: readonly TimingLane[];
  rangeMs: number;
  summary: string;
  phase: SharedValue<number>;
  testID?: string;
}) {
  const theme = useTheme();
  const toneColor = { accent: theme.accent, text: theme.text, muted: theme.textSecondary };
  const playhead = useAnimatedStyle(() => {
    const at = phase.get();
    return { opacity: at < 0 ? 0 : 1, left: `${Math.max(0, at) * 100}%` };
  });
  return (
    <View style={styles.strip} accessible role="img" aria-label={summary} testID={testID}>
      <View style={styles.row}>
        <View style={styles.labels}>
          {lanes.map((lane) => (
            <ThemedText key={lane.label} type="caption" themeColor="textSecondary" numberOfLines={1} style={styles.label}>
              {lane.label}
            </ThemedText>
          ))}
        </View>
        <View style={styles.tracks}>
          {lanes.map((lane) => (
            <View key={lane.label} style={[styles.track, { backgroundColor: theme.backgroundSelected }]}>
              <View style={[styles.beatLine, { backgroundColor: theme.textTertiary }]} />
              {lane.marks.map((ms, index) => (
                <Mark key={index} position={stripPosition(ms, rangeMs)} color={toneColor[lane.tone]} dot={lane.dots === true} phase={phase} />
              ))}
            </View>
          ))}
          <Animated.View pointerEvents="none" style={[styles.playhead, { backgroundColor: theme.accent }, playhead]} />
        </View>
      </View>
      <View style={styles.row}>
        <View style={styles.labels} />
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
  row: { flexDirection: "row", gap: Spacing.two },
  labels: { width: LABEL_WIDTH, gap: Spacing.two },
  label: { height: LANE_HEIGHT, lineHeight: LANE_HEIGHT },
  tracks: { flex: 1, gap: Spacing.two },
  track: { height: LANE_HEIGHT, borderRadius: Radius.sm, overflow: "hidden" },
  beatLine: { position: "absolute", left: "50%", top: 0, bottom: 0, width: 1, marginLeft: -0.5 },
  mark: { position: "absolute", top: 4, bottom: 4, width: 4, marginLeft: -2, borderRadius: 2 },
  dot: { position: "absolute", top: 10, width: 8, height: 8, marginLeft: -4, borderRadius: 4 },
  dotFade: { opacity: 0.75 },
  playhead: { position: "absolute", top: -4, bottom: -4, width: 2, marginLeft: -1, borderRadius: 1 },
  axis: { flex: 1, flexDirection: "row", justifyContent: "space-between" },
  tabular: { fontVariant: ["tabular-nums"] },
});
