import { useRef, useState } from "react";
import { StyleSheet, View, type KeyDownEvent } from "react-native";
import { GestureDetector, usePanGesture } from "react-native-gesture-handler";
import Animated, { useAnimatedStyle, type SharedValue } from "react-native-reanimated";

import { ThemedText } from "@/components/themed-text";
import { holdSwipe, releaseSwipe } from "@/components/ui/swipe-hold";
import { Radius, Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { markGrowth } from "@/lib/timing-test";
import { nudgeAfterDrag, stripPosition } from "@/lib/timing-strip";
import { clampLatency } from "@/settings/latency";

export const SPEAKER_STRIP_RANGE_MS = 500;

export type SpeakerLane = {
  deviceId: string;
  label: string;
  nudgeMs: number;
  playing: boolean;
};

const LABEL_WIDTH = 84;
const BEAT_POSITION = 0.5;
const HEARD_FILL = "#000000";
const HEARD_EDGE = "#FFFFFF";
const LANE_HEIGHT = 36;
const CIRCLE = 24;
const DRAG_STARTS_AFTER_PX = 8;
const SCROLL_WINS_AFTER_PX = 12;

const keyStep: Record<string, number> = { ArrowLeft: 1, ArrowRight: -1, ArrowDown: -1, ArrowUp: 1, PageUp: 10, PageDown: -10 };

function Lane({
  lane,
  phase,
  onNudge,
  onRelease,
}: {
  lane: SpeakerLane;
  phase: SharedValue<number>;
  onNudge: (deviceId: string, nudgeMs: number) => void;
  onRelease: (deviceId: string) => void;
}) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);
  const [focused, setFocused] = useState(false);
  const position = stripPosition(-lane.nudgeMs, SPEAKER_STRIP_RANGE_MS);
  const dragFrom = useRef<{ nudgeMs: number; x: number } | null>(null);
  const drag = usePanGesture({
    runOnJS: true,
    activeOffsetX: [-DRAG_STARTS_AFTER_PX, DRAG_STARTS_AFTER_PX],
    failOffsetY: [-SCROLL_WINS_AFTER_PX, SCROLL_WINS_AFTER_PX],
    onActivate: (event) => {
      holdSwipe();
      dragFrom.current = { nudgeMs: lane.nudgeMs, x: event.translationX };
    },
    onUpdate: (event) => {
      const from = dragFrom.current;
      if (from) onNudge(lane.deviceId, nudgeAfterDrag(from.nudgeMs, event.translationX - from.x, width, SPEAKER_STRIP_RANGE_MS));
    },
    onFinalize: () => {
      if (dragFrom.current === null) return;
      dragFrom.current = null;
      releaseSwipe();
      onRelease(lane.deviceId);
    },
  });
  const pulse = useAnimatedStyle(() => {
    const amount = lane.playing ? markGrowth(phase.get(), position) : 0;
    return { transform: [{ scale: 1 + amount * 0.45 }] };
  });
  const step = (by: number) => {
    onNudge(lane.deviceId, clampLatency(lane.nudgeMs + by));
    onRelease(lane.deviceId);
  };
  return (
    <GestureDetector gesture={drag} touchAction="pan-y">
      <View
        testID={`lane-${lane.deviceId}`}
        role="slider"
        aria-label={`Latency nudge for ${lane.label}`}
        aria-valuemin={-100}
        aria-valuemax={400}
        aria-valuenow={lane.nudgeMs}
        aria-valuetext={`${lane.nudgeMs} ms`}
        accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
        onAccessibilityAction={(event) => step(event.nativeEvent.actionName === "increment" ? 1 : -1)}
        tabIndex={0}
        onKeyDown={(event: KeyDownEvent) => {
          const by = keyStep[event.nativeEvent.key];
          if (by === undefined) return;
          event.preventDefault();
          step(by);
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
        style={[styles.track, { backgroundColor: theme.backgroundSelected, borderColor: focused ? theme.text : "transparent" }]}
      >
        <View pointerEvents="none" style={[styles.beatLine, { backgroundColor: theme.textTertiary }]} />
        <Animated.View
          pointerEvents="none"
          style={[
            styles.circle,
            { left: `${position * 100}%`, backgroundColor: lane.playing ? theme.accent : theme.textTertiary, borderColor: theme.background },
            pulse,
          ]}
        />
      </View>
    </GestureDetector>
  );
}

function HeardBeat({ phase, live }: { phase: SharedValue<number>; live: boolean }) {
  const theme = useTheme();
  const grow = useAnimatedStyle(() => {
    const amount = live ? markGrowth(phase.get(), BEAT_POSITION) : 0;
    return { transform: [{ scale: 1 + amount * 0.8 }] };
  });
  return (
    <View
      testID="heard-beat"
      accessible
      role="img"
      aria-label="You hear each click on the beat"
      style={[styles.track, styles.heardTrack, { backgroundColor: theme.backgroundSelected }]}
    >
      <View pointerEvents="none" style={[styles.beatLine, { backgroundColor: theme.textTertiary }]} />
      <Animated.View pointerEvents="none" style={[styles.circle, { left: `${BEAT_POSITION * 100}%`, backgroundColor: HEARD_FILL, borderColor: HEARD_EDGE }, grow]} />
    </View>
  );
}

export function SpeakerStrip({
  lanes,
  phase,
  live,
  onNudge,
  onRelease,
}: {
  lanes: readonly SpeakerLane[];
  phase: SharedValue<number>;
  live: boolean;
  onNudge: (deviceId: string, nudgeMs: number) => void;
  onRelease: (deviceId: string) => void;
}) {
  const theme = useTheme();
  const playhead = useAnimatedStyle(() => {
    const at = phase.get();
    return { opacity: at < 0 ? 0 : 1, left: `${Math.max(0, at) * 100}%` };
  });
  return (
    <View style={styles.strip} testID="speaker-strip">
      <View style={styles.row}>
        <View style={styles.labels}>
          <ThemedText type="caption" themeColor="text" numberOfLines={1} style={styles.label}>
            You hear
          </ThemedText>
          {lanes.map((lane) => (
            <ThemedText key={lane.deviceId} type="caption" themeColor={lane.playing ? "text" : "textTertiary"} numberOfLines={1} style={styles.label}>
              {lane.label}
            </ThemedText>
          ))}
        </View>
        <View style={styles.tracks}>
          <HeardBeat phase={phase} live={live} />
          {lanes.map((lane) => (
            <Lane key={lane.deviceId} lane={lane} phase={phase} onNudge={onNudge} onRelease={onRelease} />
          ))}
          <Animated.View pointerEvents="none" style={[styles.playhead, { backgroundColor: theme.accent }, playhead]} />
        </View>
      </View>
      <View style={styles.row}>
        <View style={styles.labels} />
        <View style={styles.axis}>
          <ThemedText type="caption" themeColor="textTertiary" style={styles.tabular}>
            {`${SPEAKER_STRIP_RANGE_MS} ms early`}
          </ThemedText>
          <ThemedText type="caption" themeColor="textTertiary">
            beat
          </ThemedText>
          <ThemedText type="caption" themeColor="textTertiary" style={styles.tabular}>
            {`${SPEAKER_STRIP_RANGE_MS} ms late`}
          </ThemedText>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  strip: { gap: Spacing.two },
  row: { flexDirection: "row", gap: Spacing.two },
  labels: { width: LABEL_WIDTH, gap: Spacing.two },
  label: { height: LANE_HEIGHT, lineHeight: LANE_HEIGHT },
  tracks: { flex: 1, gap: Spacing.two },
  track: { height: LANE_HEIGHT, borderRadius: Radius.sm, borderWidth: 2, justifyContent: "center" },
  beatLine: { position: "absolute", left: "50%", top: 0, bottom: 0, width: 1, marginLeft: -0.5 },
  circle: { position: "absolute", width: CIRCLE, height: CIRCLE, marginLeft: -CIRCLE / 2, borderRadius: CIRCLE / 2, borderWidth: 3, boxShadow: "0 1px 3px rgba(0, 0, 0, 0.3)" },
  heardTrack: { borderColor: "transparent" },
  playhead: { position: "absolute", top: -4, bottom: -4, width: 2, marginLeft: -1, borderRadius: 1 },
  axis: { flex: 1, flexDirection: "row", justifyContent: "space-between" },
  tabular: { fontVariant: ["tabular-nums"] },
});
