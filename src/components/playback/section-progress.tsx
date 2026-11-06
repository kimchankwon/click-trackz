import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

import { ThemedText } from "@/components/themed-text";
import { Fonts, Radius, Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { sectionProgressFrom } from "@/sync/section-progress";
import type { Beat } from "@/sync/timeline";

export function SectionProgress({ beat, serverNow }: { beat: Beat; serverNow: () => number | null }) {
  const theme = useTheme();
  const progress = useSharedValue(0);
  const countIn = beat.sectionIndex === null;

  useEffect(() => {
    const { start, to, durationMs } = sectionProgressFrom(beat, serverNow());
    progress.value = start;
    progress.value = withTiming(to, { duration: durationMs, easing: Easing.linear });
  }, [beat, serverNow, progress]);

  const fillStyle = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }));

  return (
    <View style={styles.block} testID="section-progress">
      <View style={styles.readout} aria-label={countIn ? "Count-in" : `Bar ${beat.barInSection} of ${beat.barsInSection}`}>
        <ThemedText themeColor="textSecondary" style={styles.caption}>
          {countIn ? "Count-in" : "Bar"}
        </ThemedText>
        {countIn ? null : (
          <ThemedText testID="section-bar" style={styles.barNumber}>
            {beat.barInSection}
            <ThemedText themeColor="textSecondary" style={styles.barTotal}>
              {" "}/ {beat.barsInSection}
            </ThemedText>
          </ThemedText>
        )}
      </View>
      <View style={[styles.track, { backgroundColor: theme.backgroundElement }]}>
        <Animated.View style={[styles.fill, { backgroundColor: countIn ? theme.textTertiary : theme.accent }, fillStyle]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { width: "100%", maxWidth: 360, gap: Spacing.two },
  readout: { flexDirection: "row", alignItems: "baseline", justifyContent: "center", gap: Spacing.two, minHeight: 30 },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" },
  barNumber: { fontFamily: Fonts.display, fontSize: 24, lineHeight: 30, fontWeight: 700, fontVariant: ["tabular-nums"] },
  barTotal: { fontFamily: Fonts.display, fontSize: 18, lineHeight: 30, fontWeight: 600, fontVariant: ["tabular-nums"] },
  track: { height: 8, borderRadius: Radius.pill, overflow: "hidden", width: "100%" },
  fill: { height: "100%", borderRadius: Radius.pill },
});
