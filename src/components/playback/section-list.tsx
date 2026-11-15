import { useEffect, useRef, useState, type ComponentRef } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";

import { ThemedText } from "@/components/themed-text";
import { Radius, Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { centredScrollY, SECTION_ROW_GAP, SECTION_ROW_HEIGHT, sectionListHeight, VISIBLE_SECTION_ROWS } from "@/lib/section-list";

export type SectionListRow = { title: string; plays: number; accessibleName: string; testID: string };

const SLIDE_MS = 380;

function NextTag() {
  const theme = useTheme();
  const glow = useSharedValue(1);
  useEffect(() => {
    glow.set(withRepeat(withTiming(0.35, { duration: 450 }), -1, true));
    return () => cancelAnimation(glow);
  }, [glow]);
  const style = useAnimatedStyle(() => ({ opacity: glow.value }));
  return (
    <Animated.View style={[styles.tag, { backgroundColor: theme.accent }, style]}>
      <ThemedText type="caption" themeColor="onAccent" style={styles.tagText}>
        Next
      </ThemedText>
    </Animated.View>
  );
}

export function SectionList({
  rows,
  current,
  upcoming,
  queued,
  onPress,
}: {
  rows: readonly SectionListRow[];
  current: number | null;
  upcoming: number | null;
  queued: readonly number[];
  onPress: (index: number) => void;
}) {
  const theme = useTheme();
  const list = useRef<ComponentRef<typeof ScrollView>>(null);
  const [height, setHeight] = useState(0);
  const focus = current !== null && upcoming !== null && Math.abs(upcoming - current) < VISIBLE_SECTION_ROWS ? (current + upcoming) / 2 : (upcoming ?? current);
  const highlightY = useSharedValue(current === null ? 0 : current * (SECTION_ROW_HEIGHT + SECTION_ROW_GAP));
  const highlightShown = useSharedValue(current === null ? 0 : 1);
  useEffect(() => {
    if (current === null) {
      highlightShown.set(withTiming(0, { duration: SLIDE_MS }));
      return;
    }
    highlightY.set(withTiming(current * (SECTION_ROW_HEIGHT + SECTION_ROW_GAP), { duration: SLIDE_MS, easing: Easing.out(Easing.cubic) }));
    highlightShown.set(withTiming(1, { duration: SLIDE_MS }));
  }, [current, highlightY, highlightShown]);
  const highlight = useAnimatedStyle(() => ({ opacity: highlightShown.get(), transform: [{ translateY: highlightY.get() }] }));
  useEffect(() => {
    if (focus === null || height === 0) return;
    list.current?.scrollTo({ y: centredScrollY(focus, height, rows.length), animated: true });
  }, [focus, height, rows.length]);
  return (
    <ScrollView
      ref={list}
      nestedScrollEnabled
      style={{ maxHeight: sectionListHeight(rows.length) }}
      contentContainerStyle={styles.content}
      onLayout={(event) => setHeight(event.nativeEvent.layout.height)}
      role="group"
      aria-label="Sections"
      testID="section-list"
    >
      <Animated.View pointerEvents="none" style={[styles.highlight, { backgroundColor: theme.accent }, highlight]} />
      {rows.map((row, index) => {
        const selected = index === current;
        const next = index === upcoming;
        const waiting = queued.includes(index);
        return (
          <Pressable
            key={index}
            role="button"
            aria-label={next ? `${row.accessibleName}, next` : row.accessibleName}
            aria-pressed={selected}
            testID={row.testID}
            onPress={() => onPress(index)}
            style={({ pressed }) => [
              styles.row,
              {
                backgroundColor: selected ? "transparent" : theme.backgroundSelected,
                borderColor: next || waiting ? theme.accent : "transparent",
              },
              pressed ? styles.pressed : null,
            ]}
          >
            <ThemedText numberOfLines={1} themeColor={selected ? "onAccent" : "text"} style={styles.title}>
              {row.title}
            </ThemedText>
            {row.plays > 1 ? (
              <ThemedText type="smallBold" themeColor={selected ? "onAccent" : "textSecondary"} testID={`${row.testID}-plays`}>
                {`×${row.plays}`}
              </ThemedText>
            ) : null}
            {next ? <NextTag /> : null}
            {waiting && !next ? (
              <View style={[styles.tag, styles.queuedTag, { borderColor: theme.accent }]}>
                <ThemedText type="caption" themeColor="accent" style={styles.tagText}>
                  Queued
                </ThemedText>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { gap: SECTION_ROW_GAP },
  highlight: { position: "absolute", top: 0, left: 0, right: 0, height: SECTION_ROW_HEIGHT, borderRadius: Radius.md },
  row: {
    height: SECTION_ROW_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.md,
    borderWidth: 2,
  },
  title: { flex: 1, minWidth: 0, fontSize: 16, lineHeight: 20, fontWeight: 600 },
  tag: { paddingHorizontal: Spacing.two, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  tagText: { fontWeight: 700 },
  queuedTag: { borderWidth: 1 },
  pressed: { opacity: 0.7 },
});
