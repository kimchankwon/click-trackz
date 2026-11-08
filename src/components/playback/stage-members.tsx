import { useEffect, useRef, useState, type ComponentRef } from "react";
import { Modal, Pressable, StyleSheet, useWindowDimensions, View } from "react-native";
import Animated, {
  Easing,
  LayoutAnimationConfig,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
  ZoomIn,
  ZoomOut,
} from "react-native-reanimated";

import { DISC } from "@/components/playback/beat-pulse";
import { ThemedText } from "@/components/themed-text";
import { Avatar } from "@/components/ui/avatar";
import { SignalBars } from "@/components/ui/signal-bars";
import { useTheme } from "@/hooks/use-theme";
import { accentLevelOf, type AccentLevel, type Beat } from "@/sync/timeline";

export type StageMember = { userId: string; name: string; position: number; pingMs: number | null; isYou?: boolean; started?: boolean };

type Picked = { member: StageMember; x: number; y: number; width: number; height: number };

const BUBBLE_WIDTH = 168;
const BUBBLE_GAP = 8;
const SCREEN_MARGIN = 12;

function MemberAvatar({ member, pulse, onPick }: { member: StageMember; pulse: ReturnType<typeof usePulse>; onPick: (picked: Picked) => void }) {
  const theme = useTheme();
  const anchor = useRef<ComponentRef<typeof View>>(null);
  return (
    <Pressable
      role="button"
      aria-label={`${member.name}${member.isYou ? " (you)" : ""}, online${member.started ? ", started Playback" : ""}${member.pingMs !== null ? `, ${Math.round(member.pingMs)} ms` : ""}`}
      testID={`stage-member-${member.name}`}
      hitSlop={6}
      onPress={() => anchor.current?.measureInWindow((x, y, width, height) => onPick({ member, x, y, width, height }))}
    >
      <View ref={anchor} collapsable={false}>
        <Animated.View style={[styles.ring, { borderColor: member.started ? theme.accent : theme.switchOn }, pulse]} testID={member.started ? "stage-starter" : undefined}>
          <Avatar
            name={member.name}
            size={member.started ? STARTER_AVATAR : AVATAR}
            position={member.position}
            colors={member.started ? { background: theme.accent, text: theme.onAccent } : undefined}
          />
        </Animated.View>
        {member.pingMs !== null ? (
          <View style={[styles.ping, { backgroundColor: theme.background }]}>
            <SignalBars roundTripMs={member.pingMs} size={9} testID={`stage-ping-${member.name}`} />
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

function MemberBubble({ picked, onClose }: { picked: Picked | null; onClose: () => void }) {
  const theme = useTheme();
  const screen = useWindowDimensions();
  if (picked === null) return null;
  const { member } = picked;
  const left = Math.min(Math.max(SCREEN_MARGIN, picked.x + picked.width / 2 - BUBBLE_WIDTH / 2), screen.width - BUBBLE_WIDTH - SCREEN_MARGIN);
  const above = picked.y > 120;
  return (
    <Modal transparent visible animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.dismiss} onPress={onClose} testID="member-bubble-dismiss" aria-label="Close">
        <View
          role="tooltip"
          testID="member-bubble"
          style={[
            styles.bubble,
            { left, backgroundColor: theme.inverse },
            above ? { bottom: screen.height - picked.y + BUBBLE_GAP } : { top: picked.y + picked.height + BUBBLE_GAP },
          ]}
        >
          <ThemedText type="smallBold" themeColor="onInverse" numberOfLines={1}>
            {member.name}
            {member.isYou ? " (you)" : ""}
          </ThemedText>
          {member.started ? (
            <ThemedText type="caption" themeColor="onInverse" style={styles.bubbleMuted}>
              Started Playback
            </ThemedText>
          ) : null}
          {member.pingMs !== null ? (
            <View style={styles.bubblePing}>
              <SignalBars roundTripMs={member.pingMs} size={11} />
              <ThemedText type="caption" themeColor="onInverse" style={styles.bubblePingText}>
                {Math.round(member.pingMs)} ms ping
              </ThemedText>
            </View>
          ) : (
            <ThemedText type="caption" themeColor="onInverse" style={styles.bubbleMuted}>
              Online
            </ThemedText>
          )}
        </View>
      </Pressable>
    </Modal>
  );
}

const AVATAR = 32;
const STARTER_AVATAR = 40;
const RING = 2.5;
const SIDE_GAP = 14;
const COLUMN = AVATAR + RING * 2 + 4;
const MAX_PER_SIDE = 5;

const PULSE_SCALE: Record<AccentLevel, number> = { bar: 1.14, group: 1.1, beat: 1.07 };

function usePulse(beat: Beat | null, playing: boolean) {
  const scale = useSharedValue(1);
  const beatAt = playing ? beat?.at : undefined;
  const level = beat ? accentLevelOf(beat) : "beat";
  useEffect(() => {
    if (beatAt === undefined) return;
    scale.value = withSequence(
      withTiming(PULSE_SCALE[level], { duration: 50 }),
      withTiming(1, { duration: 300, easing: Easing.out(Easing.cubic) }),
    );
  }, [beatAt, level, scale]);
  return useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
}

function Column({ members, pulse, onPick }: { members: readonly StageMember[]; pulse: ReturnType<typeof usePulse>; onPick: (picked: Picked) => void }) {
  const theme = useTheme();
  const shown = members.length > MAX_PER_SIDE ? members.slice(0, MAX_PER_SIDE - 1) : members;
  const extra = members.length - shown.length;
  return (
    <View pointerEvents="box-none" style={styles.column}>
      {shown.map((member) => (
        <Animated.View
          key={member.userId}
          entering={ZoomIn.duration(260)}
          exiting={ZoomOut.duration(220)}
          layout={LinearTransition.duration(220)}
        >
          <MemberAvatar member={member} pulse={pulse} onPick={onPick} />
        </Animated.View>
      ))}
      {extra > 0 ? (
        <Animated.View entering={ZoomIn.duration(260)} exiting={ZoomOut.duration(220)} layout={LinearTransition.duration(220)}>
          <Animated.View style={[styles.ring, styles.more, { borderColor: theme.switchOn, backgroundColor: theme.backgroundElement }, pulse]}>
            <ThemedText type="caption" themeColor="textSecondary" style={styles.moreText}>
              +{extra}
            </ThemedText>
          </Animated.View>
        </Animated.View>
      ) : null}
    </View>
  );
}

type Side = "left" | "right";

function useSides(members: readonly StageMember[]) {
  const [sides, setSides] = useState<Readonly<Record<string, Side>>>({});
  const arriving = members.filter((member) => sides[member.userId] === undefined);
  if (arriving.length > 0) {
    const next = { ...sides };
    const count = (side: Side) => members.filter((member) => next[member.userId] === side).length;
    for (const member of arriving) next[member.userId] = count("left") <= count("right") ? "left" : "right";
    setSides(next);
  }
  return (side: Side) => members.filter((member) => sides[member.userId] === side);
}

export function StageMembers({
  members,
  beat,
  playing,
  visible = true,
}: {
  members: readonly StageMember[];
  beat: Beat | null;
  playing: boolean;
  visible?: boolean;
}) {
  const pulse = usePulse(beat, playing);
  const onSide = useSides(members);
  const [picked, setPicked] = useState<Picked | null>(null);
  const [wasVisible, setWasVisible] = useState(visible);
  if (wasVisible !== visible) {
    setWasVisible(visible);
    setPicked(null);
  }
  if (!visible) return null;
  const current = picked === null ? null : members.find((member) => member.userId === picked.member.userId);
  return (
    <LayoutAnimationConfig skipEntering skipExiting>
      <View pointerEvents="box-none" style={styles.overlay}>
        <Column members={onSide("left")} pulse={pulse} onPick={setPicked} />
        <View pointerEvents="none" style={styles.discSpace} />
        <Column members={onSide("right")} pulse={pulse} onPick={setPicked} />
        <MemberBubble picked={picked && current ? { ...picked, member: current } : null} onClose={() => setPicked(null)} />
      </View>
    </LayoutAnimationConfig>
  );
}

const styles = StyleSheet.create({
  overlay: { position: "absolute", top: 0, left: 0, right: 0, height: DISC, flexDirection: "row", justifyContent: "center", gap: SIDE_GAP },
  discSpace: { width: DISC },
  column: { width: COLUMN, height: DISC, justifyContent: "center", alignItems: "center", gap: 6 },
  ring: { borderWidth: RING, borderRadius: AVATAR, padding: 1 },
  more: { width: AVATAR + RING * 2 + 2, height: AVATAR + RING * 2 + 2, alignItems: "center", justifyContent: "center" },
  moreText: { fontSize: 12, fontWeight: 700 },
  ping: { position: "absolute", right: -6, bottom: -4, paddingHorizontal: 3, paddingVertical: 2, borderRadius: 6 },
  dismiss: { flex: 1 },
  bubble: {
    position: "absolute",
    width: BUBBLE_WIDTH,
    gap: 2,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  bubblePing: { flexDirection: "row", alignItems: "center", gap: 6 },
  bubblePingText: { fontVariant: ["tabular-nums"] },
  bubbleMuted: { opacity: 0.8 },
});
