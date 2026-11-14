import { useEffect, useEffectEvent, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";

import { Avatar } from "@/components/ui/avatar";
import type { ChatEntry } from "@/chat/use-group-chat";
import { isFloating, REACTION_FLOAT_MS } from "@/lib/chat";

const RISE = 150;
const LANES = 7;

const laneOf = (chatId: string) => {
  let hash = 0;
  for (const char of chatId) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return hash % LANES;
};

function Float({ reaction, onDone }: { reaction: ChatEntry; onDone: (chatId: string) => void }) {
  const still = useReducedMotion();
  const progress = useSharedValue(0);
  const finish = useEffectEvent(() => onDone(reaction.chatId));
  useEffect(() => {
    progress.value = withTiming(1, { duration: REACTION_FLOAT_MS, easing: Easing.out(Easing.quad) });
    const timer = setTimeout(finish, REACTION_FLOAT_MS);
    return () => clearTimeout(timer);
  }, [progress, reaction.chatId]);
  const lane = laneOf(reaction.chatId);
  const style = useAnimatedStyle(() => {
    const p = progress.value;
    return {
      opacity: p < 0.1 ? p * 10 : p > 0.6 ? Math.max(0, (1 - p) / 0.4) : 1,
      transform: [
        { translateY: still ? 0 : -RISE * p },
        { translateX: still ? 0 : Math.sin(p * Math.PI * 2 + lane) * 8 },
        { scale: still ? 1 : 0.7 + Math.min(1, p * 4) * 0.3 },
      ],
    };
  });
  return (
    <Animated.View style={[styles.float, { left: `${8 + (lane * 84) / (LANES - 1)}%` }, style]} aria-hidden>
      <Text style={styles.emoji}>{reaction.text}</Text>
      <Avatar name={reaction.name} size={18} />
    </Animated.View>
  );
}

export function ReactionFloats({ reactions, now }: { reactions: readonly ChatEntry[]; now: () => number }) {
  const seen = useRef<Set<string>>(new Set());
  const [floating, setFloating] = useState<ChatEntry[]>([]);
  useEffect(() => {
    const nowMs = now();
    const fresh = reactions.filter((reaction) => !seen.current.has(reaction.chatId) && isFloating(reaction.at, nowMs));
    reactions.forEach((reaction) => seen.current.add(reaction.chatId));
    if (fresh.length > 0) setFloating((current) => [...current, ...fresh]);
  }, [reactions, now]);
  return (
    <View pointerEvents="none" style={styles.layer}>
      {floating.map((reaction) => (
        <Float key={reaction.chatId} reaction={reaction} onDone={(chatId) => setFloating((current) => current.filter((other) => other.chatId !== chatId))} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  layer: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, overflow: "visible" },
  float: { position: "absolute", bottom: 0, alignItems: "center", gap: 2 },
  emoji: { fontSize: 28, lineHeight: 34 },
});
