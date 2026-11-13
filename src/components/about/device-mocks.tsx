import { useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withTiming } from "react-native-reanimated";

import { ThemedText } from "@/components/themed-text";
import { Icon } from "@/components/ui/icon";
import { Colors, Fonts } from "@/constants/theme";
import { DEMO_SONGS, type DemoFrame } from "@/lib/demo-playback";
import { shortTitleOf } from "@/sync/section-short";
import { letterAfterNumber, type Section } from "@/sync/timeline";
import { accentPalettes } from "@/theme/accents";

import { demoActions, useDemoPlayback } from "./use-demo-playback";

const screen = { ...Colors.dark, ...accentPalettes.red.dark };

const titleOf = (section: Section) => `${section.sectionType}${section.number ? ` ${section.number}${letterAfterNumber(section)}` : ""}`;

function usePulse(frame: DemoFrame, peak: number) {
  const still = useReducedMotion();
  const scale = useSharedValue(1);
  const at = frame.beat?.at ?? null;
  useEffect(() => {
    if (still || at === null) return;
    scale.value = withSequence(withTiming(peak, { duration: 60 }), withTiming(1, { duration: 280 }));
  }, [at, peak, scale, still]);
  return useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
}

function BeatDisc({ frame, size }: { frame: DemoFrame; size: number }) {
  const pulse = usePulse(frame, 1.05);
  const live = frame.beat !== null;
  const label = frame.beat?.count ?? String(frame.song.bpm);
  const downbeat = frame.beat?.beatInBar === 1;
  const fontSize = Math.round(size * (label.length > 3 ? Math.min(0.2, 1.3 / label.length) : 0.42));
  return (
    <Animated.View
      style={[
        styles.disc,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: live ? Math.max(3, Math.round(size / 28)) : 2,
          borderColor: live ? screen.accent : screen.border,
          backgroundColor: screen.backgroundElement,
        },
        live ? pulse : null,
      ]}
    >
      <Text numberOfLines={1} style={[styles.count, { fontSize, lineHeight: Math.round(fontSize * 1.1), color: downbeat ? screen.accent : screen.text }]}>
        {label}
      </Text>
      {live ? null : <Text style={[styles.unit, { fontSize: Math.max(9, Math.round(size * 0.09)) }]}>{frame.status === "starting" ? "Starting" : "BPM · 4/4"}</Text>}
    </Animated.View>
  );
}

function BeatDots({ frame, size }: { frame: DemoFrame; size: number }) {
  const position = frame.beat?.beatInBar ?? 0;
  return (
    <View style={[styles.dots, { gap: size }]}>
      {[1, 2, 3, 4].map((dot) => (
        <View
          key={dot}
          style={{
            width: dot === position ? size * 1.5 : size,
            height: dot === position ? size * 1.5 : size,
            borderRadius: size,
            backgroundColor: dot <= position ? screen.accent : screen.dotInactive,
            opacity: dot < position ? 0.55 : 1,
          }}
        />
      ))}
    </View>
  );
}

function SongStep({ step, frame, size }: { step: -1 | 1; frame: DemoFrame; size: number }) {
  const index = DEMO_SONGS.indexOf(frame.song);
  const enabled = frame.status === "idle" && index + step >= 0 && index + step < DEMO_SONGS.length;
  return (
    <Pressable
      role="button"
      aria-label={step === 1 ? "Next Song" : "Previous Song"}
      disabled={!enabled}
      hitSlop={8}
      testID={step === 1 ? "demo-next-song" : "demo-previous-song"}
      onPress={() => demoActions.stepSong(step)}
      style={({ pressed }) => [styles.round, { width: size, height: size, borderRadius: size / 2, opacity: enabled ? (pressed ? 0.6 : 1) : 0.35 }]}
    >
      <Icon name={step === 1 ? "nextSong" : "previousSong"} size={Math.round(size * 0.45)} tint={screen.text} />
    </Pressable>
  );
}

export function PlayScreenMock({ width = 280 }: { width?: number }) {
  const frame = useDemoPlayback();
  const s = width / 280;
  const height = Math.round(width * 2.06);
  const bezel = Math.round(10 * s);
  const sections = frame.song.sections;
  const shownIndex = frame.sectionIndex ?? 0;
  const current = sections[shownIndex];
  const next = sections[shownIndex + 1];
  const live = frame.status !== "idle";
  const stopping = frame.status === "stopping";
  return (
    <View style={[styles.phone, { width, height, borderRadius: 46 * s, padding: bezel }]} testID="demo-phone">
      <View style={[styles.phoneScreen, { borderRadius: 38 * s, paddingHorizontal: 16 * s, paddingTop: 50 * s, paddingBottom: 18 * s, gap: 16 * s }]}>
        <View style={[styles.island, { width: 86 * s, height: 26 * s, borderRadius: 13 * s, top: 12 * s }]} />
        <View style={{ gap: 2 * s }}>
          <Text numberOfLines={1} style={[styles.screenCaption, { fontSize: 12 * s, lineHeight: 16 * s }]}>{`${frame.song.title} · ${frame.song.bpm} BPM · 4/4`}</Text>
          <Text numberOfLines={1} style={[styles.screenTitle, { fontSize: 28 * s, lineHeight: 34 * s }]}>
            {live ? titleOf(current) : "Ready to start"}
          </Text>
          <Text numberOfLines={1} style={[styles.screenCaption, { fontSize: 13 * s, lineHeight: 18 * s }]}>
            {frame.jumpingTo !== null ? `Jumping to ${titleOf(sections[frame.jumpingTo])} at the bar line` : live ? (next ? `Next: ${titleOf(next)}` : "Last Section") : `From ${titleOf(sections[0])}`}
          </Text>
        </View>
        <View style={[styles.center, { gap: 12 * s }]} aria-live="polite">
          <BeatDisc frame={frame} size={140 * s} />
          <BeatDots frame={frame} size={9 * s} />
        </View>
        <View style={[styles.chips, { gap: 6 * s }]}>
          {sections.map((section, index) => {
            const now = live && index === frame.sectionIndex;
            const pending = index === frame.jumpingTo;
            return (
              <Pressable
                key={index}
                role="button"
                aria-label={live ? `Jump to ${titleOf(section)}` : `Start from ${titleOf(section)}`}
                hitSlop={6}
                testID={`demo-section-${index}`}
                disabled={stopping}
                onPress={() => (live ? demoActions.jump(index) : demoActions.start(index))}
                style={({ pressed }) => [
                  styles.chip,
                  {
                    paddingHorizontal: 9 * s,
                    height: 30 * s,
                    borderRadius: 10 * s,
                    backgroundColor: now ? screen.accentTint : screen.backgroundElement,
                    borderColor: now || pending ? screen.accent : screen.border,
                    borderStyle: pending ? "dashed" : "solid",
                    opacity: pressed ? 0.6 : 1,
                  },
                ]}
              >
                <Text style={[styles.chipText, { fontSize: 12 * s, color: now ? screen.accent : screen.textSecondary }]}>{shortTitleOf(section)}</Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={[styles.hint, { fontSize: 11 * s }]}>{live ? "Tap a Section to jump to it" : "Tap a Section to start from it"}</Text>
        <View style={[styles.transport, { gap: 10 * s, marginTop: "auto" }]}>
          <SongStep step={-1} frame={frame} size={44 * s} />
          <Pressable
            role="button"
            aria-label={live ? "Stop" : `Start ${frame.song.title}`}
            testID="demo-start-stop"
            disabled={stopping}
            onPress={() => (live ? demoActions.stop() : demoActions.start())}
            style={({ pressed }) => [
              styles.stop,
              { height: 48 * s, borderRadius: 24 * s, backgroundColor: live ? screen.stopFill : screen.accent, opacity: pressed || stopping ? 0.7 : 1 },
            ]}
          >
            <Icon name={live ? "stop" : "play"} size={Math.round(16 * s)} tint={live ? screen.onStop : screen.onAccent} />
            <Text style={[styles.stopText, { fontSize: 16 * s, color: live ? screen.onStop : screen.onAccent }]}>{stopping ? "Stopping…" : live ? "Stop" : "Start"}</Text>
          </Pressable>
          <SongStep step={1} frame={frame} size={44 * s} />
        </View>
      </View>
    </View>
  );
}

export function MiniDevice({ kind, label, width }: { kind: "phone" | "tablet"; label: string; width: number }) {
  const frame = useDemoPlayback();
  const tall = kind === "phone";
  const height = Math.round(width * (tall ? 1.95 : 1.32));
  const s = width / 160;
  return (
    <View style={[styles.center, { gap: 10 }]}>
      <View style={[styles.phone, { width, height, borderRadius: (tall ? 30 : 22) * s, padding: 6 * s }]}>
        <View style={[styles.phoneScreen, styles.center, { borderRadius: (tall ? 25 : 17) * s, gap: 12 * s }]}>
          <BeatDisc frame={frame} size={Math.min(width, height) * 0.58} />
          <BeatDots frame={frame} size={6 * s} />
        </View>
      </View>
      <ThemedText type="caption" themeColor="textSecondary">
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  phone: { backgroundColor: "#0B0B0C", borderWidth: 1, borderColor: "#3A3B3F" },
  phoneScreen: { flex: 1, backgroundColor: screen.background, overflow: "hidden" },
  island: { position: "absolute", alignSelf: "center", backgroundColor: "#0B0B0C" },
  center: { alignItems: "center", justifyContent: "center" },
  disc: { alignItems: "center", justifyContent: "center" },
  count: { fontFamily: Fonts.condensed, fontWeight: "700", letterSpacing: -0.5, textAlign: "center", fontVariant: ["tabular-nums"] },
  unit: { fontFamily: Fonts.body, fontWeight: "600", color: screen.textSecondary },
  dots: { flexDirection: "row", alignItems: "center", height: 16 },
  screenCaption: { fontFamily: Fonts.body, fontWeight: "500", color: screen.textSecondary },
  screenTitle: { fontFamily: Fonts.display, fontWeight: "800", letterSpacing: -0.5, color: screen.text },
  chips: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center" },
  chip: { alignItems: "center", justifyContent: "center", borderWidth: 1 },
  chipText: { fontFamily: Fonts.body, fontWeight: "700" },
  hint: { fontFamily: Fonts.body, fontWeight: "500", color: screen.textTertiary, textAlign: "center" },
  transport: { flexDirection: "row", alignItems: "center" },
  round: { alignItems: "center", justifyContent: "center", backgroundColor: screen.backgroundElement },
  stop: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  stopText: { fontFamily: Fonts.body, fontWeight: "700" },
});
