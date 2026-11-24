import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { Easing, interpolateColor, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

import { ThemedText } from "@/components/themed-text";
import { Fonts, Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { carouselSlot, sideScaleFor } from "@/lib/section-carousel";
import { useFlash } from "@/components/playback/cue-motion";

const SIDE_WIDTH = 76;
const LABEL_HEIGHT = 14;
const HEIGHT = 60;
const SLIDE_MS = 380;

type CarouselEntry = { index: number | null; title: string; pass?: string | null };

type Shown = {
  key: string;
  previous: CarouselEntry | null;
  current: CarouselEntry;
  next: CarouselEntry | null;
  outgoing: CarouselEntry | null;
  step: number;
};

const keyOf = (entry: CarouselEntry | null) => (entry === null ? "none" : `${entry.index}:${entry.pass ?? ""}:${entry.title}`);

function Title({
  entry,
  slot,
  enter,
  width,
  colors,
  testID,
}: {
  entry: CarouselEntry;
  slot: number;
  enter: number;
  width: number;
  colors: { previous: string; current: string; next: string };
  testID?: string;
}) {
  const fontSize = entry.title.length > 9 ? 32 : 40;
  const centreWidth = Math.max(0, width - 2 * (SIDE_WIDTH + Spacing.two));
  const sideScale = sideScaleFor(fontSize, centreWidth, SIDE_WIDTH);
  const shift = useSharedValue(enter);
  useEffect(() => {
    if (shift.get() !== 0) shift.set(withTiming(0, { duration: SLIDE_MS, easing: Easing.out(Easing.cubic) }));
  }, [shift]);
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
  nextFlashes,
}: {
  previous: CarouselEntry | null;
  current: CarouselEntry;
  next: CarouselEntry | null;
  nextLabel: string;
  nextAccent: boolean;
  nextFlashes: boolean;
}) {
  const theme = useTheme();
  const glow = useFlash(nextFlashes);
  const flash = useAnimatedStyle(() => ({ opacity: glow.get() }));
  const [width, setWidth] = useState(0);
  const key = keyOf(current);
  const [shown, setShown] = useState<Shown>({ key, previous, current, next, outgoing: null, step: 0 });
  if (shown.key !== key) {
    const forward = shown.next !== null && shown.next.index !== null && shown.next.index === current.index;
    setShown({ key, previous, current, next, outgoing: forward ? shown.previous : null, step: forward ? shown.step + 1 : shown.step });
  } else if (keyOf(shown.previous) !== keyOf(previous) || keyOf(shown.next) !== keyOf(next) || shown.current.title !== current.title) {
    setShown({ ...shown, previous, current, next });
  }
  const [settledStep, setSettledStep] = useState(0);
  useEffect(() => {
    const timer = setTimeout(() => setSettledStep(shown.step), SLIDE_MS);
    return () => clearTimeout(timer);
  }, [shown.step]);
  const enter = shown.step !== settledStep ? 1 : 0;
  const colors = { previous: theme.textSecondary, current: theme.text, next: nextAccent ? theme.accent : theme.textSecondary };
  return (
    <View style={styles.row} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
      <View style={styles.labels} pointerEvents="none">
        <ThemedText themeColor="textTertiary" style={styles.label}>
          {shown.previous ? "Previous" : " "}
        </ThemedText>
        <Animated.View style={flash} testID="playback-next-label">
          <ThemedText themeColor={nextAccent ? "accent" : "textTertiary"} style={[styles.label, styles.labelEnd]}>
            {shown.next || nextAccent ? nextLabel : " "}
          </ThemedText>
        </Animated.View>
      </View>
      {width > 0 ? (
        <View style={styles.titles} aria-live="polite">
          {shown.outgoing ? <Title key={`out-${keyOf(shown.outgoing)}-${shown.step}`} entry={shown.outgoing} slot={-2} enter={enter} width={width} colors={colors} /> : null}
          {shown.previous ? <Title key={`prev-${keyOf(shown.previous)}-${shown.step}`} entry={shown.previous} slot={-1} enter={enter} width={width} colors={colors} testID="previous-section" /> : null}
          <Title key={`now-${key}`} entry={shown.current} slot={0} enter={enter} width={width} colors={colors} testID="current-section" />
          {shown.next ? <Title key={`next-${keyOf(shown.next)}-${shown.step}`} entry={shown.next} slot={1} enter={enter} width={width} colors={colors} testID="playback-next" /> : null}
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
