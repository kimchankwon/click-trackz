import { useEffect, useRef, useState, type ComponentRef } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  LayoutAnimationConfig,
  LinearTransition,
  useAnimatedStyle,
  FadeIn,
  FadeOut,
  useSharedValue,
  withSequence,
  withTiming,
  ZoomIn,
  ZoomOut,
} from "react-native-reanimated";

import type { OnlineListAnchor } from "@/components/group/online-members";
import { DISC } from "@/components/playback/beat-pulse";
import { ThemedText } from "@/components/themed-text";
import { Avatar } from "@/components/ui/avatar";
import { SignalBars } from "@/components/ui/signal-bars";
import { useTheme } from "@/hooks/use-theme";
import { accentLevelOf, type AccentLevel, type Beat } from "@/sync/timeline";

type StageMember = { userId: string; name: string; position: number; pingMs: number | null; isYou?: boolean; started?: boolean };

type StageBubble = { text: string; at: number };

type OpenList = (anchor: OnlineListAnchor) => void;

function SaidBubble({ bubble }: { bubble: StageBubble }) {
  const theme = useTheme();
  return (
    <Animated.View key={bubble.at} entering={FadeIn.duration(180)} exiting={FadeOut.duration(400)} pointerEvents="none" style={styles.saidFrame} testID="stage-said">
      <View style={[styles.said, { backgroundColor: theme.inverse }]}>
        <ThemedText themeColor="onInverse" numberOfLines={2} style={styles.saidText}>
          {bubble.text}
        </ThemedText>
        <View style={[styles.saidTail, { borderTopColor: theme.inverse }]} />
      </View>
    </Animated.View>
  );
}

function MemberAvatar({ member, said, pulse, onOpen }: { member: StageMember; said?: StageBubble; pulse: ReturnType<typeof usePulse>; onOpen: OpenList }) {
  const theme = useTheme();
  const anchor = useRef<ComponentRef<typeof View>>(null);
  return (
    <Pressable
      role="button"
      aria-label={`${member.name}${member.isYou ? " (you)" : ""}, online${member.started ? ", started Playback" : ""}${member.pingMs !== null ? `, ${Math.round(member.pingMs)} ms` : ""}. Show who is online`}
      aria-haspopup="dialog"
      testID={`stage-member-${member.name}`}
      hitSlop={6}
      onPress={() => anchor.current?.measureInWindow((x, y, width, height) => onOpen({ x, y, width, height, focus: member.userId }))}
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
        {said ? <SaidBubble key={said.at} bubble={said} /> : null}
      </View>
    </Pressable>
  );
}

const SAID_WIDTH = 112;
const AVATAR = 32;
const STARTER_AVATAR = 40;
const RING = 2.5;
const SIDE_GAP = 14;
const COLUMN = AVATAR + RING * 2 + 4;
const COLUMN_GAP = 6;
const SLOT = AVATAR + RING * 2 + 2;
const STARTER_SLOT = STARTER_AVATAR + RING * 2 + 2;
const MAX_PER_SIDE = Math.max(1, Math.floor((DISC - STARTER_SLOT + SLOT + COLUMN_GAP) / (SLOT + COLUMN_GAP)));

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

function Column({
  members,
  bubbles,
  pulse,
  onOpen,
}: {
  members: readonly StageMember[];
  bubbles: ReadonlyMap<string, StageBubble>;
  pulse: ReturnType<typeof usePulse>;
  onOpen: OpenList;
}) {
  const theme = useTheme();
  const more = useRef<ComponentRef<typeof View>>(null);
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
          <MemberAvatar member={member} said={bubbles.get(member.userId)} pulse={pulse} onOpen={onOpen} />
        </Animated.View>
      ))}
      {extra > 0 ? (
        <Animated.View entering={ZoomIn.duration(260)} exiting={ZoomOut.duration(220)} layout={LinearTransition.duration(220)}>
          <Pressable
            role="button"
            aria-label={`${extra} more online. Show who is online`}
            aria-haspopup="dialog"
            testID="stage-members-more"
            hitSlop={6}
            onPress={() => more.current?.measureInWindow((x, y, width, height) => onOpen({ x, y, width, height }))}
          >
            <View ref={more} collapsable={false}>
              <Animated.View style={[styles.ring, styles.more, { borderColor: theme.switchOn, backgroundColor: theme.backgroundElement }, pulse]}>
                <ThemedText type="caption" themeColor="textSecondary" style={styles.moreText}>
                  +{extra}
                </ThemedText>
              </Animated.View>
            </View>
          </Pressable>
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

const NO_BUBBLES: ReadonlyMap<string, StageBubble> = new Map();

export function StageMembers({
  members,
  beat,
  playing,
  visible = true,
  bubbles = NO_BUBBLES,
  onOpen,
}: {
  members: readonly StageMember[];
  beat: Beat | null;
  playing: boolean;
  visible?: boolean;
  bubbles?: ReadonlyMap<string, StageBubble>;
  onOpen: OpenList;
}) {
  const pulse = usePulse(beat, playing);
  const onSide = useSides(members);
  if (!visible) return null;
  return (
    <LayoutAnimationConfig skipEntering skipExiting>
      <View pointerEvents="box-none" style={styles.overlay}>
        <Column members={onSide("left")} bubbles={bubbles} pulse={pulse} onOpen={onOpen} />
        <View pointerEvents="none" style={styles.discSpace} />
        <Column members={onSide("right")} bubbles={bubbles} pulse={pulse} onOpen={onOpen} />
      </View>
    </LayoutAnimationConfig>
  );
}

const styles = StyleSheet.create({
  overlay: { position: "absolute", top: 0, left: 0, right: 0, height: DISC, flexDirection: "row", justifyContent: "center", gap: SIDE_GAP },
  discSpace: { width: DISC },
  column: { width: COLUMN, height: DISC, justifyContent: "center", alignItems: "center", gap: COLUMN_GAP },
  ring: { borderWidth: RING, borderRadius: AVATAR, padding: 1 },
  more: { width: SLOT, height: SLOT, alignItems: "center", justifyContent: "center" },
  moreText: { fontSize: 12, fontWeight: 700 },
  ping: { position: "absolute", right: -6, bottom: -4, paddingHorizontal: 3, paddingVertical: 2, borderRadius: 6 },
  saidFrame: { position: "absolute", bottom: "100%", left: "50%", width: SAID_WIDTH, marginLeft: -SAID_WIDTH / 2, marginBottom: 6, alignItems: "center", zIndex: 2 },
  said: { maxWidth: SAID_WIDTH, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 8 },
  saidText: { fontSize: 10, lineHeight: 13, fontWeight: 600, textAlign: "center" },
  saidTail: {
    position: "absolute",
    bottom: -4,
    alignSelf: "center",
    width: 0,
    height: 0,
    borderLeftWidth: 4,
    borderRightWidth: 4,
    borderTopWidth: 4,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
  },
});
