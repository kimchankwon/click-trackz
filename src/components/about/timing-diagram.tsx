import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withSequence, withTiming, type SharedValue } from "react-native-reanimated";

import { ThemedText } from "@/components/themed-text";
import { Radius, Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

import { DEMO_BAR_MS, demoBarPhase } from "./use-demo-beat";

const ON_TIME = [0.02, 0.27, 0.52, 0.77];
const OVER_NETWORK = [
  [0.05, 0.25, 0.58, 0.79],
  [0.02, 0.33, 0.5, 0.86],
  [0.1, 0.29, 0.55, 0.74],
];
const FLASH = 0.07;
const DEVICES = ["Drums", "Keys", "Vocals"] as const;

function useBarProgress() {
  const still = useReducedMotion();
  const progress = useSharedValue(0);
  useEffect(() => {
    if (still) return;
    const phase = demoBarPhase();
    progress.value = phase;
    progress.value = withSequence(
      withTiming(1, { duration: (1 - phase) * DEMO_BAR_MS, easing: Easing.linear }),
      withRepeat(withSequence(withTiming(0, { duration: 0 }), withTiming(1, { duration: DEMO_BAR_MS, easing: Easing.linear })), -1, false),
    );
    return () => cancelAnimation(progress);
  }, [still, progress]);
  return { progress, still };
}

function Tick({ at, progress, color, still }: { at: number; progress: SharedValue<number>; color: string; still: boolean }) {
  const style = useAnimatedStyle(() => {
    const since = progress.value - at;
    const hit = since >= 0 && since < FLASH;
    return { opacity: still || hit ? 1 : 0.35, transform: [{ scaleY: hit ? 1.25 : 1 }] };
  });
  return <Animated.View style={[styles.tick, { left: `${at * 100}%`, backgroundColor: color }, style]} />;
}

function Lane({ name, ticks, progress, color, still }: { name: string; ticks: readonly number[]; progress: SharedValue<number>; color: string; still: boolean }) {
  const theme = useTheme();
  return (
    <View style={styles.lane}>
      <ThemedText type="caption" themeColor="textSecondary" style={styles.laneName}>
        {name}
      </ThemedText>
      <View style={[styles.track, { borderBottomColor: theme.inputBorder }]}>
        {ON_TIME.map((at) => (
          <View key={at} style={[styles.gridLine, { left: `${at * 100 + 0.6}%`, backgroundColor: theme.border }]} />
        ))}
        {ticks.map((at) => (
          <Tick key={at} at={at} progress={progress} color={color} still={still} />
        ))}
      </View>
    </View>
  );
}

function Playhead({ progress, width, still }: { progress: SharedValue<number>; width: number; still: boolean }) {
  const theme = useTheme();
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: progress.value * width }] }));
  if (still || width === 0) return null;
  return <Animated.View pointerEvents="none" style={[styles.playhead, { backgroundColor: theme.text }, style]} />;
}

function Panel({ title, caption, rows, color, highlighted }: { title: string; caption: string; rows: readonly (readonly number[])[]; color: string; highlighted?: boolean }) {
  const theme = useTheme();
  const { progress, still } = useBarProgress();
  const [width, setWidth] = useState(0);
  return (
    <View style={[styles.panel, { backgroundColor: theme.background, borderColor: highlighted ? theme.accent : theme.border }, highlighted ? styles.highlighted : null]}>
      <View style={styles.panelHead}>
        <ThemedText type="heading">{title}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {caption}
        </ThemedText>
      </View>
      <View style={styles.lanes}>
        <View style={styles.playheadArea} onLayout={(event) => setWidth(event.nativeEvent.layout.width)} pointerEvents="none">
          <Playhead progress={progress} width={width} still={still} />
        </View>
        {rows.map((ticks, index) => (
          <Lane key={DEVICES[index]} name={DEVICES[index]} ticks={ticks} progress={progress} color={color} still={still} />
        ))}
      </View>
    </View>
  );
}

export function TimingDiagram() {
  const theme = useTheme();
  return (
    <View style={styles.panels} role="img" aria-label="Three devices playing one bar. Beats sent over the network land at different moments; with Click Trackz every device lands on the beat together.">
      <Panel title="Beats sent over the network" caption="Each device plays a beat whenever it arrives." rows={OVER_NETWORK} color={theme.textSecondary} />
      <Panel title="Click Trackz" caption="Every device plays the same schedule from one shared clock." rows={[ON_TIME, ON_TIME, ON_TIME]} color={theme.accent} highlighted />
    </View>
  );
}

const LABEL_WIDTH = 64;

const styles = StyleSheet.create({
  panels: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.three },
  panel: { flexGrow: 1, flexBasis: 320, minWidth: 0, gap: Spacing.three, padding: Spacing.four, borderRadius: Radius.lg, borderWidth: 1 },
  highlighted: { borderWidth: 2 },
  panelHead: { gap: Spacing.one },
  lanes: { gap: Spacing.three },
  lane: { flexDirection: "row", alignItems: "center", gap: Spacing.two },
  laneName: { width: LABEL_WIDTH - Spacing.two },
  track: { flex: 1, height: 30, borderBottomWidth: 1, borderStyle: "dashed" },
  gridLine: { position: "absolute", top: 0, bottom: 0, width: 1 },
  tick: { position: "absolute", bottom: 0, width: 6, height: 24, borderRadius: 3 },
  playheadArea: { position: "absolute", top: -6, bottom: -6, left: LABEL_WIDTH, right: 0 },
  playhead: { position: "absolute", top: 0, bottom: 0, width: 2, borderRadius: 1, opacity: 0.5 },
});
