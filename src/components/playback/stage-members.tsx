import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { Easing, LinearTransition, useAnimatedStyle, useSharedValue, withSequence, withTiming, ZoomIn, ZoomOut } from "react-native-reanimated";

import { DISC } from "@/components/playback/beat-pulse";
import { ThemedText } from "@/components/themed-text";
import { Avatar } from "@/components/ui/avatar";
import { SignalBars } from "@/components/ui/signal-bars";
import { useTheme } from "@/hooks/use-theme";
import type { Beat } from "@/sync/timeline";

export type StageMember = { userId: string; name: string; position: number; pingMs: number | null };

const AVATAR = 32;
const RING = 2.5;
const SIDE_GAP = 14;
const COLUMN = AVATAR + RING * 2 + 4;
const MAX_PER_SIDE = 5;

function usePulse(beat: Beat | null, playing: boolean) {
  const scale = useSharedValue(1);
  const beatAt = playing ? beat?.at : undefined;
  const accent = beat?.accent ?? false;
  useEffect(() => {
    if (beatAt === undefined) return;
    scale.value = withSequence(
      withTiming(accent ? 1.14 : 1.07, { duration: 50 }),
      withTiming(1, { duration: 300, easing: Easing.out(Easing.cubic) }),
    );
  }, [beatAt, accent, scale]);
  return useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
}

function Column({ members, pulse }: { members: readonly StageMember[]; pulse: ReturnType<typeof usePulse> }) {
  const theme = useTheme();
  const shown = members.length > MAX_PER_SIDE ? members.slice(0, MAX_PER_SIDE - 1) : members;
  const extra = members.length - shown.length;
  return (
    <View style={styles.column}>
      {shown.map((member) => (
        <Animated.View
          key={member.userId}
          entering={ZoomIn.duration(260)}
          exiting={ZoomOut.duration(220)}
          layout={LinearTransition.duration(220)}
          testID={`stage-member-${member.name}`}
          aria-label={`${member.name}, online`}
        >
          <Animated.View style={[styles.ring, { borderColor: theme.switchOn }, pulse]}>
            <Avatar name={member.name} size={AVATAR} position={member.position} />
          </Animated.View>
          {member.pingMs !== null ? (
            <View style={[styles.ping, { backgroundColor: theme.background }]}>
              <SignalBars roundTripMs={member.pingMs} size={9} testID={`stage-ping-${member.name}`} />
            </View>
          ) : null}
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

export function StageMembers({ members, beat, playing }: { members: readonly StageMember[]; beat: Beat | null; playing: boolean }) {
  const pulse = usePulse(beat, playing);
  const onSide = useSides(members);
  return (
    <View pointerEvents="none" style={styles.overlay}>
      <Column members={onSide("left")} pulse={pulse} />
      <View style={styles.discSpace} />
      <Column members={onSide("right")} pulse={pulse} />
    </View>
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
});
