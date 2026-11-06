import { useEffect, useRef, type ReactNode } from "react";
import { StyleSheet } from "react-native";
import { GestureDetector, usePanGesture } from "react-native-gesture-handler";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

import { swipeStep } from "@/lib/swipe-step";

const FOLLOW = 0.35;
const ENTER_FROM = 56;

export function SwipeTabs<T extends string>({
  tabs,
  active,
  onChange,
  children,
}: {
  tabs: readonly T[];
  active: T;
  onChange: (tab: T) => void;
  children: ReactNode;
}) {
  const offset = useSharedValue(0);
  const latest = useRef({ tabs, active, onChange });
  useEffect(() => {
    latest.current = { tabs, active, onChange };
  }, [tabs, active, onChange]);

  const pan = usePanGesture({
    activeOffsetX: [-24, 24],
    failOffsetY: [-14, 14],
    runOnJS: true,
    onUpdate: (event) => {
      const { tabs: list, active: current } = latest.current;
      const index = list.indexOf(current);
      const atEdge = (event.translationX > 0 && index === 0) || (event.translationX < 0 && index === list.length - 1);
      offset.value = event.translationX * (atEdge ? FOLLOW / 3 : FOLLOW);
    },
    onDeactivate: (event) => {
      const { tabs: list, active: current, onChange: change } = latest.current;
      const step = event.canceled ? 0 : swipeStep(event.translationX, event.velocityX);
      const next = list[list.indexOf(current) + step];
      if (step !== 0 && next !== undefined) {
        change(next);
        offset.value = step * ENTER_FROM;
      }
      offset.value = withTiming(0, { duration: 220, easing: Easing.out(Easing.cubic) });
    },
  });

  const slide = useAnimatedStyle(() => ({
    opacity: 1 - Math.min(Math.abs(offset.value) / 400, 0.25),
    transform: [{ translateX: offset.value }],
  }));

  return (
    <GestureDetector gesture={pan} touchAction="pan-y">
      <Animated.View style={[styles.fill, slide]}>{children}</Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
