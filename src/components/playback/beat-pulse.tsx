import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { ThemedText } from "@/components/themed-text";
import { Fonts, Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import type { Beat } from "@/sync/timeline";

export type IdleReadout = { value: string; unit: string; detail?: string };

type Props = {
  beat: Beat | null;
  playing: boolean;
  idle?: IdleReadout | null;
};

export function BeatPulse({ beat, playing, idle }: Props) {
  const theme = useTheme();
  const scale = useSharedValue(1);
  const ring = useSharedValue(0);
  const beatAt = playing ? beat?.at : undefined;
  const accent = beat?.accent ?? false;

  useEffect(() => {
    if (beatAt === undefined) return;
    scale.value = withSequence(
      withTiming(accent ? 1.16 : 1.07, { duration: 45 }),
      withTiming(1, { duration: 260, easing: Easing.out(Easing.cubic) }),
    );
    ring.value = 0;
    ring.value = withTiming(1, { duration: accent ? 520 : 380, easing: Easing.out(Easing.quad) });
  }, [beatAt, accent, scale, ring]);

  const countStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const ringStyle = useAnimatedStyle(() => ({
    opacity: (1 - ring.value) * (accent ? 0.55 : 0.3),
    transform: [{ scale: 0.75 + ring.value * 0.55 }],
  }));

  const beatsPerBar = beat?.beatsPerBar ?? 4;
  const live = playing && beat !== null;
  const label = live ? beat.count : "";
  return (
    <View style={styles.stage}>
      <View style={styles.circleBox}>
        <Animated.View style={[styles.ring, { borderColor: theme.accent }, ringStyle]} />
        <View style={[styles.disc, { backgroundColor: theme.backgroundElement, borderColor: live ? theme.accent : theme.border }]}>
          {live ? (
            <Animated.Text
              testID="playback-count"
              numberOfLines={1}
              style={[styles.count, countFontFor(label), { color: accent ? theme.accent : theme.text }, countStyle]}
            >
              {label}
            </Animated.Text>
          ) : (
            <View style={styles.idle} testID="playback-count">
              <ThemedText style={[styles.idleValue, { color: idle ? theme.text : theme.textTertiary }]}>{idle?.value ?? "--"}</ThemedText>
              <ThemedText type="label" themeColor="textSecondary">
                {idle?.unit ?? "No Song picked"}
              </ThemedText>
              {idle?.detail ? (
                <ThemedText type="caption" themeColor="textSecondary" style={styles.idleDetail}>
                  {idle.detail}
                </ThemedText>
              ) : null}
            </View>
          )}
        </View>
      </View>
      <View style={styles.dots} testID="beat-dots">
        {Array.from({ length: beatsPerBar }, (_, index) => {
          const active = playing && beat?.beatInBar === index + 1;
          return (
            <View
              key={index}
              style={[
                styles.dot,
                index === 0 ? styles.downbeatDot : null,
                { backgroundColor: active ? theme.accent : theme.backgroundSelected },
              ]}
            />
          );
        })}
      </View>
    </View>
  );
}

const DISC = 256;
const DISC_TEXT_WIDTH = DISC - Spacing.four * 2;
const MAX_COUNT_FONT = 132;
const CONDENSED_WIDTH_PER_FONT_PX = 0.6;

function countFontFor(label: string) {
  const fontSize = Math.min(MAX_COUNT_FONT, Math.floor(DISC_TEXT_WIDTH / (label.length * CONDENSED_WIDTH_PER_FONT_PX)));
  return { fontSize, lineHeight: Math.round(fontSize * 1.1) };
}

const styles = StyleSheet.create({
  stage: { alignItems: "center", gap: Spacing.three },
  circleBox: { width: DISC + 56, height: DISC + 56, alignItems: "center", justifyContent: "center" },
  ring: { position: "absolute", width: DISC + 48, height: DISC + 48, borderRadius: (DISC + 48) / 2, borderWidth: 6 },
  disc: {
    width: DISC,
    height: DISC,
    borderRadius: DISC / 2,
    borderWidth: 3,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.four,
  },
  count: {
    fontFamily: Fonts.condensed,
    fontWeight: "700",
    textAlign: "center",
    fontVariant: ["tabular-nums"],
    letterSpacing: -1,
  },
  idle: { alignItems: "center", gap: Spacing.one },
  idleValue: { fontFamily: Fonts.condensed, fontSize: 88, lineHeight: 92, fontWeight: "700", fontVariant: ["tabular-nums"] },
  idleDetail: { marginTop: Spacing.one },
  dots: { flexDirection: "row", gap: Spacing.three, alignItems: "center", minHeight: 20 },
  dot: { width: 14, height: 14, borderRadius: 7 },
  downbeatDot: { width: 20, height: 20, borderRadius: 10 },
});
