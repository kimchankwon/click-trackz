import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from "react-native-reanimated";

import { ThemedText } from "@/components/themed-text";
import { Colors, Fonts } from "@/constants/theme";
import { accentPalettes } from "@/theme/accents";

import { useDemoBeat } from "./use-demo-beat";

const screen = { ...Colors.dark, ...accentPalettes.red.dark };

const SECTIONS = ["Intro", "Vs1", "Ch. 1", "Br"] as const;
const CURRENT_SECTION = "Ch. 1";

function usePulse(peak: number) {
  const beat = useDemoBeat();
  const scale = useSharedValue(1);
  useEffect(() => {
    scale.value = withSequence(withTiming(peak, { duration: 60 }), withTiming(1, { duration: 280 }));
  }, [beat.index, peak, scale]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return { beat, style };
}

function BeatDisc({ size }: { size: number }) {
  const { beat, style } = usePulse(1.05);
  const downbeat = beat.beatInBar === 1;
  const fontSize = Math.round(size * (beat.count.length > 2 ? 0.2 : 0.46));
  return (
    <Animated.View
      style={[
        styles.disc,
        { width: size, height: size, borderRadius: size / 2, borderWidth: Math.max(3, Math.round(size / 28)), borderColor: screen.accent, backgroundColor: screen.backgroundElement },
        style,
      ]}
    >
      <Text numberOfLines={1} style={[styles.count, { fontSize, lineHeight: Math.round(fontSize * 1.1), color: downbeat ? screen.accent : screen.text }]}>
        {beat.count}
      </Text>
    </Animated.View>
  );
}

function BeatDots({ size }: { size: number }) {
  const beat = useDemoBeat();
  return (
    <View style={[styles.dots, { gap: size }]}>
      {[1, 2, 3, 4].map((position) => (
        <View
          key={position}
          style={{
            width: position === beat.beatInBar ? size * 1.5 : size,
            height: position === beat.beatInBar ? size * 1.5 : size,
            borderRadius: size,
            backgroundColor: position <= beat.beatInBar ? screen.accent : screen.dotInactive,
            opacity: position < beat.beatInBar ? 0.55 : 1,
          }}
        />
      ))}
    </View>
  );
}

export function PlayScreenMock({ width = 280 }: { width?: number }) {
  const s = width / 280;
  const height = Math.round(width * 2.06);
  const bezel = Math.round(10 * s);
  return (
    <View
      role="img"
      aria-label="An iPhone showing Click Trackz playing Chorus 1, with the Count and beat dots moving in time"
      style={[styles.phone, { width, height, borderRadius: 46 * s, padding: bezel }]}
    >
      <View style={[styles.phoneScreen, { borderRadius: 38 * s, paddingHorizontal: 18 * s, paddingTop: 52 * s, paddingBottom: 22 * s, gap: 18 * s }]}>
        <View style={[styles.island, { width: 86 * s, height: 26 * s, borderRadius: 13 * s, top: 12 * s }]} />
        <View style={{ gap: 2 * s }}>
          <Text style={[styles.screenCaption, { fontSize: 12 * s, lineHeight: 16 * s }]}>Sunday Set · 72 BPM · 4/4</Text>
          <Text style={[styles.screenTitle, { fontSize: 30 * s, lineHeight: 36 * s }]}>Chorus 1</Text>
          <Text style={[styles.screenCaption, { fontSize: 13 * s, lineHeight: 18 * s }]}>Next: Bridge</Text>
        </View>
        <View style={[styles.center, { gap: 14 * s }]}>
          <BeatDisc size={150 * s} />
          <BeatDots size={9 * s} />
        </View>
        <View style={[styles.chips, { gap: 6 * s }]}>
          {SECTIONS.map((section) => {
            const current = section === CURRENT_SECTION;
            return (
              <View
                key={section}
                style={[
                  styles.chip,
                  { paddingHorizontal: 10 * s, height: 30 * s, borderRadius: 10 * s, backgroundColor: current ? screen.accentTint : screen.backgroundElement, borderColor: current ? screen.accent : screen.border },
                ]}
              >
                <Text style={[styles.chipText, { fontSize: 13 * s, color: current ? screen.accent : screen.textSecondary }]}>{section}</Text>
              </View>
            );
          })}
        </View>
        <View style={[styles.stop, { height: 48 * s, borderRadius: 24 * s, marginTop: "auto" }]}>
          <View style={{ width: 12 * s, height: 12 * s, borderRadius: 2 * s, backgroundColor: screen.onStop }} />
          <Text style={[styles.stopText, { fontSize: 16 * s }]}>Stop</Text>
        </View>
      </View>
    </View>
  );
}

export function MiniDevice({ kind, label, width }: { kind: "phone" | "tablet"; label: string; width: number }) {
  const tall = kind === "phone";
  const height = Math.round(width * (tall ? 1.95 : 1.32));
  const s = width / 160;
  return (
    <View style={[styles.center, { gap: 10 }]}>
      <View style={[styles.phone, { width, height, borderRadius: (tall ? 30 : 22) * s, padding: 6 * s }]}>
        <View style={[styles.phoneScreen, styles.center, { borderRadius: (tall ? 25 : 17) * s, gap: 12 * s }]}>
          <BeatDisc size={Math.min(width, height) * 0.58} />
          <BeatDots size={6 * s} />
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
  dots: { flexDirection: "row", alignItems: "center", height: 16 },
  screenCaption: { fontFamily: Fonts.body, fontWeight: "500", color: screen.textSecondary },
  screenTitle: { fontFamily: Fonts.display, fontWeight: "800", letterSpacing: -0.5, color: screen.text },
  chips: { flexDirection: "row", justifyContent: "center" },
  chip: { alignItems: "center", justifyContent: "center", borderWidth: 1 },
  chipText: { fontFamily: Fonts.body, fontWeight: "700" },
  stop: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: screen.stopFill },
  stopText: { fontFamily: Fonts.body, fontWeight: "700", color: screen.onStop },
});
