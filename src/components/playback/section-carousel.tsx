import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { Easing, interpolateColor, useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from "react-native-reanimated";

import { ThemedText } from "@/components/themed-text";
import { Fonts, Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { carouselSlot, sideScaleFor } from "@/lib/section-carousel";

const SIDE_WIDTH = 76;
const LABEL_HEIGHT = 14;
const HEIGHT = 60;
const SLIDE_MS = 380;

export type CarouselEntry = { index: number | null; title: string };

type Shown = {
  key: string;
  previous: CarouselEntry | null;
  current: CarouselEntry;
  next: CarouselEntry | null;
  outgoing: CarouselEntry | null;
  step: number;
};

const keyOf = (entry: CarouselEntry | null) => (entry === null ? "none" : `${entry.index}:${entry.title}`);

function Title({
  entry,
  slot,
  shift,
  width,
  colors,
  testID,
}: {
  entry: CarouselEntry;
  slot: number;
  shift: SharedValue<number>;
  width: number;
  colors: { previous: string; current: string; next: string };
  testID?: string;
}) {
  const fontSize = entry.title.length > 9 ? 32 : 40;
  const sideScale = sideScaleFor(fontSize);
  const centreWidth = Math.max(0, width - 2 * (SIDE_WIDTH + Spacing.two));
  const style = useAnimatedStyle(() => {
    const place = carouselSlot(slot + shift.value, width, SIDE_WIDTH, sideScale);
    return {
      opacity: place.opacity,
      color: interpolateColor(Math.max(-1, Math.min(1, slot + shift.value)), [-1, 0, 1], [colors.previous, colors.current, colors.next]),
      transform: [{ translateX: place.centreX - centreWidth / 2 }, { translateY: place.drop }, { scale: place.scale }],
    };
  });
  return (
    <Animated.Text
      testID={testID}
      numberOfLines={1}
      adjustsFontSizeToFit
      minimumFontScale={0.5}
      style={[styles.title, { width: centreWidth, fontSize, lineHeight: fontSize + 6 }, style]}
    >
      {entry.title}
    </Animated.Text>
  );
}

export function SectionCarousel({
  previous,
  current,
  next,
  nextLabel,
  nextAccent,
}: {
  previous: CarouselEntry | null;
  current: CarouselEntry;
  next: CarouselEntry | null;
  nextLabel: string;
  nextAccent: boolean;
}) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);
  const shift = useSharedValue(0);
  const key = keyOf(current);
  const [shown, setShown] = useState<Shown>({ key, previous, current, next, outgoing: null, step: 0 });
  if (shown.key !== key) {
    const forward = shown.next !== null && shown.next.index !== null && shown.next.index === current.index;
    setShown({ key, previous, current, next, outgoing: forward ? shown.previous : null, step: forward ? shown.step + 1 : shown.step });
  } else if (keyOf(shown.previous) !== keyOf(previous) || keyOf(shown.next) !== keyOf(next) || shown.current.title !== current.title) {
    setShown({ ...shown, previous, current, next });
  }
  useEffect(() => {
    if (shown.step === 0) return;
    shift.set(1);
    shift.set(withTiming(0, { duration: SLIDE_MS, easing: Easing.out(Easing.cubic) }));
  }, [shown.step, shift]);
  const colors = { previous: theme.textSecondary, current: theme.text, next: nextAccent ? theme.accent : theme.textSecondary };
  return (
    <View style={styles.row} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
      <View style={styles.labels} pointerEvents="none">
        <ThemedText themeColor="textTertiary" style={styles.label}>
          {shown.previous ? "Previous" : " "}
        </ThemedText>
        <ThemedText themeColor={nextAccent ? "accent" : "textTertiary"} style={[styles.label, styles.labelEnd]}>
          {shown.next || nextAccent ? nextLabel : " "}
        </ThemedText>
      </View>
      {width > 0 ? (
        <View style={styles.titles} aria-live="polite">
          {shown.outgoing ? <Title key={`out-${keyOf(shown.outgoing)}-${shown.step}`} entry={shown.outgoing} slot={-2} shift={shift} width={width} colors={colors} /> : null}
          {shown.previous ? <Title key={`prev-${keyOf(shown.previous)}`} entry={shown.previous} slot={-1} shift={shift} width={width} colors={colors} testID="previous-section" /> : null}
          <Title key={`now-${key}`} entry={shown.current} slot={0} shift={shift} width={width} colors={colors} testID="current-section" />
          {shown.next ? <Title key={`next-${keyOf(shown.next)}`} entry={shown.next} slot={1} shift={shift} width={width} colors={colors} testID="playback-next" /> : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { width: "100%", height: HEIGHT, overflow: "hidden" },
  labels: { flexDirection: "row", justifyContent: "space-between", height: LABEL_HEIGHT },
  label: { width: SIDE_WIDTH, fontSize: 11, lineHeight: LABEL_HEIGHT, fontWeight: 700, letterSpacing: 0.8, textTransform: "uppercase" },
  labelEnd: { textAlign: "right" },
  titles: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0 },
  title: { position: "absolute", top: 8, left: 0, fontFamily: Fonts.display, fontWeight: 800, textAlign: "center" },
});
