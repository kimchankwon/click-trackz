import { useEffect } from "react";
import { Platform, StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { countFontSize, EM_PER_CHARACTER } from "@/components/playback/count-font";
import { ThemedText } from "@/components/themed-text";
import { Fonts, Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { accentLevelOf, beatGroupSize, type AccentLevel, type Beat } from "@/sync/timeline";

export type IdleReadout = { value: string; unit: string; detail?: string; beatsPerBar?: number; beatUnit?: number };

type Props = {
  beat: Beat | null;
  playing: boolean;
  idle?: IdleReadout | null;
};

const COUNT_SCALE: Record<AccentLevel, number> = { bar: 1.16, group: 1.11, beat: 1.07 };
const DISC_SCALE: Record<AccentLevel, number> = { bar: 1.06, group: 1.045, beat: 1.03 };

export function BeatPulse({ beat, playing, idle }: Props) {
  const theme = useTheme();
  const scale = useSharedValue(1);
  const discScale = useSharedValue(1);
  const ring = useSharedValue(0);
  const ending = useSharedValue(0);
  const beatAt = playing ? beat?.at : undefined;
  const accent = beat?.accent ?? false;
  const level = beat ? accentLevelOf(beat) : "beat";

  useEffect(() => {
    if (beatAt === undefined) return;
    scale.value = withSequence(
      withTiming(COUNT_SCALE[level], { duration: 45 }),
      withTiming(1, { duration: 260, easing: Easing.out(Easing.cubic) }),
    );
    discScale.value = withSequence(
      withTiming(DISC_SCALE[level], { duration: 50 }),
      withTiming(1, { duration: 300, easing: Easing.out(Easing.cubic) }),
    );
    ring.value = 0;
    ring.value = withTiming(1, { duration: level === "beat" ? 380 : 520, easing: Easing.out(Easing.quad) });
  }, [beatAt, level, scale, discScale, ring]);

  const lastBar = playing && beat !== null && beat.barInSection === beat.barsInSection;
  const endingFrom = lastBar ? (beat.beatInBar - 1) / beat.beatsPerBar : 0;
  const endingTo = lastBar ? beat.beatInBar / beat.beatsPerBar : 0;
  const beatMs = beat?.beatMs ?? 0;

  useEffect(() => {
    if (!lastBar) {
      ending.value = withTiming(0, { duration: 180 });
      return;
    }
    ending.value = endingFrom;
    ending.value = withTiming(endingTo, { duration: beatMs, easing: Easing.linear });
  }, [lastBar, endingFrom, endingTo, beatMs, beatAt, ending]);

  const background = theme.backgroundElement;
  const endingBackground = theme.warningTint;
  const border = theme.accent;
  const endingBorder = theme.warning;
  const endingStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(ending.value, [0, 1], [background, endingBackground]),
    borderColor: interpolateColor(ending.value, [0, 1], [border, endingBorder]),
  }));

  const countStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const discStyle = useAnimatedStyle(() => ({
    opacity: 1 - (1 - ring.value) * (accent ? 0.18 : 0.08),
    transform: [{ scale: discScale.value }],
  }));

  const beatsPerBar = (playing ? beat?.beatsPerBar : undefined) ?? idle?.beatsPerBar ?? 4;
  const groupSize = beatGroupSize(beatsPerBar, (playing ? beat?.beatUnit : undefined) ?? idle?.beatUnit);
  const dense = beatsPerBar > DENSE_FROM;
  const live = playing && beat !== null;
  const label = live ? beat.count : "";
  return (
    <View style={styles.stage}>
      <View style={styles.circleBox}>
        <Animated.View
          testID="beat-disc"
          aria-label={lastBar ? "Last bar of this Section" : undefined}
          style={[
            styles.disc,
            { backgroundColor: theme.backgroundElement, borderColor: live ? theme.accent : theme.border },
            live ? styles.discLive : null,
            live ? discStyle : null,
            live ? endingStyle : null,
          ]}
        >
          {live ? (
            <Animated.Text
              testID="playback-count"
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={MIN_FONT_SCALE}
              style={[styles.count, countFontFor(label), { color: accent ? theme.accent : theme.text }, countStyle]}
            >
              {label}
            </Animated.Text>
          ) : (
            <View style={styles.idle} testID="playback-count">
              <ThemedText
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={MIN_FONT_SCALE}
                style={[styles.idleValue, { color: idle ? theme.text : theme.textTertiary }]}
              >
                {idle?.value ?? "--"}
              </ThemedText>
              <ThemedText numberOfLines={1} adjustsFontSizeToFit minimumFontScale={MIN_FONT_SCALE} themeColor="textSecondary" style={styles.idleUnit}>
                {[idle?.unit ?? "No Song picked", idle?.detail].filter(Boolean).join(" · ")}
              </ThemedText>
            </View>
          )}
        </Animated.View>
      </View>
      <View style={[styles.dots, dense ? styles.denseDots : null, live ? null : styles.dotsIdle]} testID="beat-dots">
        {Array.from({ length: beatsPerBar }, (_, index) => {
          const startsGroup = index > 0 && index % groupSize === 0;
          const position = live ? beat.beatInBar : 0;
          const active = position === index + 1;
          const past = position > index + 1;
          return (
            <View key={index} style={[styles.dotSlot, dense ? styles.denseSlot : null, startsGroup ? (dense ? styles.denseGroupGap : styles.groupGap) : null]}>
              <View
                style={[
                  styles.dot,
                  dense ? styles.denseDot : null,
                  active ? styles.activeDot : null,
                  { backgroundColor: active || past ? theme.accent : theme.dotInactive },
                  past && !active ? styles.pastDot : null,
                  index === 0 && !active ? [styles.downbeat, { borderColor: theme.textSecondary }] : null,
                ]}
              />
            </View>
          );
        })}
      </View>
    </View>
  );
}

export const DISC = 212;
const DENSE_FROM = 7;
const DISC_TEXT_WIDTH = DISC - Spacing.four * 2;
const COUNT_TEXT_WIDTH = Math.floor(DISC_TEXT_WIDTH / COUNT_SCALE.bar);
const MIN_FONT_SCALE = 0.2;
const EM_PER_COUNT_CHARACTER = Platform.select({ web: EM_PER_CHARACTER.web, ios: EM_PER_CHARACTER.ios, default: EM_PER_CHARACTER.android });

function countFontFor(label: string) {
  const fontSize = countFontSize(label, COUNT_TEXT_WIDTH, EM_PER_COUNT_CHARACTER);
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
    maxWidth: COUNT_TEXT_WIDTH,
    fontFamily: Fonts.condensed,
    fontWeight: "700",
    textAlign: "center",
    fontVariant: ["tabular-nums"],
    letterSpacing: -1,
  },
  idle: { alignSelf: "stretch", alignItems: "center", gap: Spacing.one },
  discLive: { borderWidth: 6 },
  idleValue: { fontFamily: Fonts.condensed, fontSize: 76, lineHeight: 80, fontWeight: "700", fontVariant: ["tabular-nums"] },
  idleUnit: { fontSize: 18, lineHeight: 24, fontWeight: 600, marginTop: Spacing.one },
  dots: { flexDirection: "row", alignItems: "center", gap: Spacing.two, minHeight: 32 },
  dotsIdle: { opacity: 0.6 },
  dotSlot: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  dot: { width: 22, height: 22, borderRadius: 11 },
  denseDots: { gap: Spacing.half },
  denseSlot: { width: 18, height: 22 },
  denseDot: { width: 14, height: 14, borderRadius: 7 },
  activeDot: { transform: [{ scale: 1.35 }] },
  groupGap: { marginLeft: Spacing.two },
  denseGroupGap: { marginLeft: Spacing.one },
  pastDot: { opacity: 0.35 },
  downbeat: { borderWidth: 2 },
});
