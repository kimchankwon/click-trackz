import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import type { Beat } from "@/sync/timeline";

type Props = {
  beat: Beat | null;
  playing: boolean;
};

export function BeatPulse({ beat, playing }: Props) {
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
  return (
    <View style={styles.stage}>
      <View style={styles.circleBox}>
        <Animated.View style={[styles.ring, { borderColor: theme.accent }, ringStyle]} />
        <View style={[styles.disc, { backgroundColor: theme.backgroundElement }]}>
          <Animated.Text
            testID="playback-count"
            numberOfLines={1}
            adjustsFontSizeToFit
            style={[
              styles.count,
              { color: playing && accent ? theme.accent : theme.text },
              countStyle,
            ]}
          >
            {playing && beat ? beat.count : "–"}
          </Animated.Text>
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

const DISC = 240;

const styles = StyleSheet.create({
  stage: { alignItems: "center", gap: Spacing.four, paddingVertical: Spacing.four },
  circleBox: { width: DISC + 80, height: DISC + 80, alignItems: "center", justifyContent: "center" },
  ring: { position: "absolute", width: DISC + 60, height: DISC + 60, borderRadius: (DISC + 60) / 2, borderWidth: 6 },
  disc: {
    width: DISC,
    height: DISC,
    borderRadius: DISC / 2,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.four,
  },
  count: { fontSize: 72, lineHeight: 84, fontWeight: "800", textAlign: "center" },
  dots: { flexDirection: "row", gap: Spacing.three, alignItems: "center" },
  dot: { width: 14, height: 14, borderRadius: 7 },
  downbeatDot: { width: 20, height: 20, borderRadius: 10 },
});
