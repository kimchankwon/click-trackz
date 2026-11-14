import { StyleSheet, View } from "react-native";

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

export function BeatLights({ count, lit, testID }: { count: number; lit: number | null; testID?: string }) {
  const theme = useTheme();
  return (
    <View style={styles.lights} testID={testID} aria-hidden>
      {Array.from({ length: count }, (_, index) => (
        <View
          key={index}
          style={[styles.light, index === lit ? [styles.litLight, { backgroundColor: theme.accent }] : { backgroundColor: theme.backgroundSelected }]}
        />
      ))}
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
  lights: { flexDirection: "row", justifyContent: "center", gap: Spacing.three },
  light: { width: 18, height: 18, borderRadius: 9 },
  litLight: { transform: [{ scale: 1.5 }] },
});
