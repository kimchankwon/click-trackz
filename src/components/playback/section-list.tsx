import { useEffect, useRef, useState, type ComponentRef } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { Easing, interpolateColor, useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from "react-native-reanimated";

import { useFlash, useLeadProgress } from "@/components/playback/cue-motion";
import { ThemedText } from "@/components/themed-text";
import { Fonts, Radius, Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { centredScrollY, SECTION_ROW_GAP, SECTION_ROW_HEIGHT, sectionListHeight, VISIBLE_SECTION_ROWS } from "@/lib/section-list";
import type { Beat } from "@/sync/timeline";

export type SectionListRow = { title: string; plays: number; accessibleName: string; testID: string };

const SLIDE_MS = 380;
const STEP = SECTION_ROW_HEIGHT + SECTION_ROW_GAP;
const BORDER = 2;
const TAG_ROOM = 72;

function NextTag({ lead }: { lead: SharedValue<number> }) {
  const theme = useTheme();
  const glow = useFlash(true);
  const accent = theme.accent;
  const warning = theme.warning;
  const onAccent = theme.onAccent;
  const onWarning = theme.onWarning;
  const tag = useAnimatedStyle(() => ({ opacity: glow.get(), backgroundColor: interpolateColor(lead.get(), [0, 1], [accent, warning]) }));
  const words = useAnimatedStyle(() => ({ color: interpolateColor(lead.get(), [0, 1], [onAccent, onWarning]) }));
  return (
    <Animated.View style={[styles.tag, tag]} testID="section-next-tag">
      <Animated.Text style={[styles.tagText, words]}>Next</Animated.Text>
    </Animated.View>
  );
}

function NextEdge({ lead }: { lead: SharedValue<number> }) {
  const theme = useTheme();
  const accent = theme.accent;
  const warning = theme.warning;
  const edge = useAnimatedStyle(() => ({ borderColor: interpolateColor(lead.get(), [0, 1], [accent, warning]) }));
  return <Animated.View pointerEvents="none" style={[styles.edge, edge]} testID="section-next-edge" />;
}

function RowLine({ row, tagged, title, plays, playsTestID }: { row: SectionListRow; tagged: boolean; title: string; plays: string; playsTestID?: string }) {
  return (
    <View style={[styles.line, tagged ? styles.tagged : null]}>
      <Text numberOfLines={1} style={[styles.title, { color: title }]}>
        {row.title}
      </Text>
      {row.plays > 1 ? (
        <Text testID={playsTestID} style={[styles.plays, { color: plays }]}>
          {`×${row.plays}`}
        </Text>
      ) : null}
    </View>
  );
}

export function SectionList({
  rows,
  current,
  upcoming,
  queued,
  beat,
  playing,
  onPress,
}: {
  rows: readonly SectionListRow[];
  current: number | null;
  upcoming: number | null;
  queued: readonly number[];
  beat: Beat | null;
  playing: boolean;
  onPress: (index: number) => void;
}) {
  const theme = useTheme();
  const list = useRef<ComponentRef<typeof ScrollView>>(null);
  const [height, setHeight] = useState(0);
  const lead = useLeadProgress(beat, playing);
  const focus = current !== null && upcoming !== null && Math.abs(upcoming - current) < VISIBLE_SECTION_ROWS ? (current + upcoming) / 2 : (upcoming ?? current);
  const highlightY = useSharedValue(current === null ? 0 : current * STEP);
  const highlightShown = useSharedValue(current === null ? 0 : 1);
  useEffect(() => {
    if (current === null) {
      highlightShown.set(withTiming(0, { duration: SLIDE_MS }));
      return;
    }
    const target = current * STEP;
    if (highlightShown.get() === 0) {
      highlightY.set(target);
      highlightShown.set(withTiming(1, { duration: SLIDE_MS }));
      return;
    }
    highlightY.set(withTiming(target, { duration: SLIDE_MS, easing: Easing.out(Easing.cubic) }));
    highlightShown.set(withTiming(1, { duration: SLIDE_MS }));
  }, [current, highlightY, highlightShown]);
  const highlight = useAnimatedStyle(() => ({ opacity: highlightShown.get(), transform: [{ translateY: highlightY.get() }] }));
  const litLines = useAnimatedStyle(() => ({ transform: [{ translateY: -highlightY.get() }] }));
  useEffect(() => {
    if (focus === null || height === 0) return;
    list.current?.scrollTo({ y: centredScrollY(focus, height, rows.length), animated: true });
  }, [focus, height, rows.length]);
  const taggedRow = (index: number) => index === upcoming || queued.includes(index);
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
      {rows.map((row, index) => (
        <View key={`ground-${index}`} pointerEvents="none" style={[styles.ground, { top: index * STEP, backgroundColor: theme.backgroundSelected }]} />
      ))}
      {rows.map((row, index) => {
        const next = index === upcoming;
        return (
          <Pressable
            key={index}
            role="button"
            aria-label={next ? `${row.accessibleName}, next` : row.accessibleName}
            aria-pressed={index === current}
            testID={row.testID}
            onPress={() => onPress(index)}
            style={styles.row}
          >
            <RowLine row={row} tagged={taggedRow(index)} title={theme.text} plays={theme.textSecondary} playsTestID={`${row.testID}-plays`} />
          </Pressable>
        );
      })}
      <Animated.View
        pointerEvents="none"
        aria-hidden
        importantForAccessibility="no-hide-descendants"
        style={[styles.highlight, { backgroundColor: theme.accent }, highlight]}
        testID="section-highlight"
      >
        <Animated.View style={[styles.litLines, litLines]}>
          {rows.map((row, index) => (
            <View key={`lit-${index}`} style={[styles.litRow, { top: index * STEP }]} testID={`${row.testID}-lit`}>
              <RowLine row={row} tagged={taggedRow(index)} title={theme.onAccent} plays={theme.onAccent} />
            </View>
          ))}
        </Animated.View>
      </Animated.View>
      {rows.map((row, index) => {
        const next = index === upcoming;
        const waiting = queued.includes(index);
        if (!next && !waiting) return null;
        return (
          <View key={`marks-${index}`} pointerEvents="none" style={[styles.marks, { top: index * STEP }]}>
            {next ? <NextEdge lead={lead} /> : <View style={[styles.edge, { borderColor: theme.accent }]} />}
            {next ? (
              <NextTag lead={lead} />
            ) : (
              <View style={[styles.tag, styles.queuedTag, { borderColor: theme.accent, backgroundColor: theme.backgroundSelected }]}>
                <ThemedText type="caption" themeColor="accent" style={styles.queuedText}>
                  Queued
                </ThemedText>
              </View>
            )}
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { gap: SECTION_ROW_GAP },
  ground: { position: "absolute", left: 0, right: 0, height: SECTION_ROW_HEIGHT, borderRadius: Radius.md },
  highlight: { position: "absolute", top: 0, left: 0, right: 0, height: SECTION_ROW_HEIGHT, borderRadius: Radius.md, overflow: "hidden" },
  litLines: { position: "absolute", top: 0, left: 0, right: 0 },
  litRow: { position: "absolute", left: 0, right: 0, height: SECTION_ROW_HEIGHT },
  row: { height: SECTION_ROW_HEIGHT, borderRadius: Radius.md },
  line: { flex: 1, flexDirection: "row", alignItems: "center", gap: Spacing.two, paddingHorizontal: Spacing.three + BORDER },
  tagged: { paddingRight: TAG_ROOM },
  marks: {
    position: "absolute",
    left: 0,
    right: 0,
    height: SECTION_ROW_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    paddingHorizontal: Spacing.three + BORDER,
  },
  edge: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, borderWidth: BORDER, borderRadius: Radius.md },
  title: { flex: 1, minWidth: 0, fontFamily: Fonts.body, fontSize: 16, lineHeight: 20, fontWeight: 600 },
  plays: { fontFamily: Fonts.body, fontSize: 14, lineHeight: 20, fontWeight: 700 },
  tag: { paddingHorizontal: Spacing.two, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  tagText: { fontFamily: Fonts.body, fontSize: 13, lineHeight: 18, fontWeight: 700 },
  queuedText: { fontWeight: 700 },
  queuedTag: { borderWidth: 1 },
});
