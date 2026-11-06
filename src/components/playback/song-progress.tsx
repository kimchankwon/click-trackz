import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming } from "react-native-reanimated";

import { ThemedText } from "@/components/themed-text";
import { Radius, Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { clockText, elapsedShare, type SongSpan } from "@/sync/song-span";

const LABEL_EVERY_MS = 250;

export function SongProgress({ span, lengthMs, serverNow }: { span: SongSpan | null; lengthMs: number; serverNow: () => number | null }) {
  const theme = useTheme();
  const progress = useSharedValue(0);
  const [elapsed, setElapsed] = useState<{ span: SongSpan; ms: number } | null>(null);
  const totalMs = span ? span.endsAt - span.startsAt : lengthMs;
  const elapsedMs = span !== null && elapsed?.span === span ? elapsed.ms : 0;

  useEffect(() => {
    if (span === null) {
      progress.value = 0;
      return;
    }
    const now = serverNow();
    const share = elapsedShare(span, now);
    const remainingMs = (1 - share) * (span.endsAt - span.startsAt);
    const waitMs = now === null ? 0 : Math.max(0, span.startsAt - now);
    progress.value = share;
    progress.value = withDelay(waitMs, withTiming(1, { duration: remainingMs, easing: Easing.linear }));
    const tick = () => setElapsed({ span, ms: elapsedShare(span, serverNow()) * (span.endsAt - span.startsAt) });
    const timer = setInterval(tick, LABEL_EVERY_MS);
    return () => clearInterval(timer);
  }, [span, serverNow, progress]);

  const fillStyle = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }));

  return (
    <View style={styles.block} testID="song-progress" aria-label={`Song ${clockText(elapsedMs)} of ${clockText(totalMs)}`}>
      <ThemedText themeColor="textSecondary" style={styles.time} testID="song-elapsed">
        {clockText(elapsedMs)}
      </ThemedText>
      <View style={[styles.track, { backgroundColor: theme.backgroundSelected }]}>
        <Animated.View style={[styles.fill, { backgroundColor: theme.accent }, fillStyle]} />
      </View>
      <ThemedText themeColor="textSecondary" style={styles.time} testID="song-length">
        {clockText(totalMs)}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { flexDirection: "row", alignItems: "center", gap: Spacing.two, width: "100%" },
  time: { width: 40, fontSize: 12, lineHeight: 16, fontWeight: 600, fontVariant: ["tabular-nums"], textAlign: "center" },
  track: { flex: 1, height: 4, borderRadius: Radius.pill, overflow: "hidden" },
  fill: { height: "100%", borderRadius: Radius.pill },
});
