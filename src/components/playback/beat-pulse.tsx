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
  const discStyle = useAnimatedStyle(() => ({ opacity: 1 - (1 - ring.value) * (accent ? 0.18 : 0.08) }));

  const beatsPerBar = beat?.beatsPerBar ?? 4;
  const live = playing && beat !== null;
  const label = live ? beat.count : "";
  return (
    <View style={styles.stage}>
      <View style={styles.circleBox}>
        <Animated.View
          style={[styles.disc, { backgroundColor: theme.backgroundElement, borderColor: live ? theme.accent : theme.border }, live ? styles.discLive : null, live ? discStyle : null]}
        >
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
              <ThemedText themeColor="textSecondary" style={styles.idleUnit}>
                {[idle?.unit ?? "No Song picked", idle?.detail].filter(Boolean).join(" · ")}
              </ThemedText>
            </View>
          )}
        </Animated.View>
      </View>
      <View style={[styles.dots, live ? null : styles.dotsIdle]} testID="beat-dots">
        {Array.from({ length: beatsPerBar }, (_, index) => {
          const position = live ? beat.beatInBar : 0;
          const active = position === index + 1;
          const past = position > index + 1;
          return (
            <View key={index} style={styles.dotSlot}>
              <View
                style={[
                  styles.dot,
                  active ? styles.activeDot : null,
                  { backgroundColor: active ? theme.accent : past ? theme.dotPast : theme.dotInactive },
                  index === 0 && !active ? [styles.downbeat, { borderColor: theme.textTertiary }] : null,
                ]}
              />
            </View>
          );
        })}
      </View>
    </View>
  );
}

const DISC = 212;
const DISC_TEXT_WIDTH = DISC - Spacing.four * 2;
const MAX_COUNT_FONT = 124;
const CONDENSED_WIDTH_PER_FONT_PX = 0.6;

function countFontFor(label: string) {
  const fontSize = Math.min(MAX_COUNT_FONT, Math.floor(DISC_TEXT_WIDTH / (label.length * CONDENSED_WIDTH_PER_FONT_PX)));
  return { fontSize, lineHeight: Math.round(fontSize * 1.1) };
}

const styles = StyleSheet.create({
  stage: { alignItems: "center", gap: Spacing.three },
  circleBox: { width: DISC, height: DISC, alignItems: "center", justifyContent: "center" },
  disc: {
    width: DISC,
    height: DISC,
    borderRadius: DISC / 2,
    borderWidth: 2,
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
  discLive: { borderWidth: 6 },
  idleValue: { fontFamily: Fonts.condensed, fontSize: 76, lineHeight: 80, fontWeight: "700", fontVariant: ["tabular-nums"] },
  idleUnit: { fontSize: 18, lineHeight: 24, fontWeight: 600, marginTop: Spacing.one },
  dots: { flexDirection: "row", alignItems: "center", gap: Spacing.two, minHeight: 32 },
  dotsIdle: { opacity: 0.6 },
  dotSlot: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  dot: { width: 24, height: 24, borderRadius: 12 },
  activeDot: { width: 32, height: 32, borderRadius: 16 },
  downbeat: { borderWidth: 2 },
});
