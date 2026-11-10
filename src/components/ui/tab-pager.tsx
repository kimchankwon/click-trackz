import { useEffect, useRef, useState, type ComponentRef, type ReactNode } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { GestureDetector, usePanGesture } from "react-native-gesture-handler";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

import { swipeStep } from "@/lib/swipe-step";

import { swipeHeld } from "./swipe-hold";

const EDGE_FOLLOW = 0.3;
const SETTLE = { duration: 260, easing: Easing.out(Easing.cubic) };
const CLICK_AFTER_SWIPE_MS = 300;

export type TabPage<T extends string> = { key: T; content: ReactNode };

export function TabPager<T extends string>({ pages, active, onChange }: { pages: readonly TabPage<T>[]; active: T; onChange: (tab: T) => void }) {
  const index = Math.max(0, pages.findIndex((page) => page.key === active));
  const [width, setWidth] = useState(0);
  const x = useSharedValue(0);
  const latest = useRef({ pages, index, width, onChange });
  const settlingTo = useRef<number | null>(null);
  const shownWidth = useRef(0);
  const host = useRef<ComponentRef<typeof View>>(null);
  const held = useRef(false);
  const swiped = useRef(false);

  useEffect(() => {
    latest.current = { pages, index, width, onChange };
  }, [pages, index, width, onChange]);

  useEffect(() => {
    if (width === 0) return;
    const target = -index * width;
    if (shownWidth.current !== width) {
      shownWidth.current = width;
      settlingTo.current = null;
      x.set(target);
      return;
    }
    if (settlingTo.current === index) {
      settlingTo.current = null;
      return;
    }
    settlingTo.current = null;
    x.set(withTiming(target, SETTLE));
  }, [index, width, x]);

  useEffect(() => {
    const node = host.current as unknown as HTMLElement | null;
    if (Platform.OS !== "web" || !node?.addEventListener) return;
    const swallow = (event: Event) => {
      if (!swiped.current) return;
      swiped.current = false;
      event.stopPropagation();
      event.preventDefault();
    };
    node.addEventListener("click", swallow, true);
    return () => node.removeEventListener("click", swallow, true);
  }, []);

  const pan = usePanGesture({
    activeOffsetX: [-24, 24],
    failOffsetY: [-14, 14],
    runOnJS: true,
    onBegin: () => {
      held.current = swipeHeld();
    },
    onActivate: () => {
      held.current = held.current || swipeHeld();
      swiped.current = !held.current;
    },
    onUpdate: (event) => {
      const { pages: list, index: current, width: pageWidth } = latest.current;
      if (held.current || swipeHeld()) {
        held.current = true;
        x.set(-current * pageWidth);
        return;
      }
      const atEdge = (event.translationX > 0 && current === 0) || (event.translationX < 0 && current === list.length - 1);
      x.set(-current * pageWidth + event.translationX * (atEdge ? EDGE_FOLLOW : 1));
    },
    onDeactivate: (event) => {
      const { pages: list, index: current, width: pageWidth, onChange: change } = latest.current;
      const step = event.canceled || held.current ? 0 : swipeStep(event.translationX, event.velocityX);
      const next = list[current + step] === undefined ? current : current + step;
      x.set(withTiming(-next * pageWidth, SETTLE));
      if (next !== current) {
        settlingTo.current = next;
        change(list[next].key);
      }
      setTimeout(() => {
        swiped.current = false;
      }, CLICK_AFTER_SWIPE_MS);
    },
  });

  const slide = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }] }));

  return (
    <View ref={host} style={styles.frame} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
      <GestureDetector gesture={pan} touchAction="pan-y">
        <Animated.View style={[styles.row, slide]}>
          {pages.map((page, at) => {
            const shown = at === index;
            return (
              <View
                key={page.key}
                testID={`page-${page.key}`}
                style={[styles.page, width > 0 ? { width } : null]}
                aria-hidden={!shown}
                importantForAccessibility={shown ? "auto" : "no-hide-descendants"}
              >
                {page.content}
              </View>
            );
          })}
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { flex: 1, overflow: "hidden" },
  row: { flex: 1, flexDirection: "row" },
  page: { width: "100%", flexShrink: 0 },
});
