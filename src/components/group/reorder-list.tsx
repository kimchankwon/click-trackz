import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { StyleSheet, View, type KeyDownEvent } from "react-native";
import { GestureDetector, usePanGesture } from "react-native-gesture-handler";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from "react-native-reanimated";

import { Icon } from "@/components/ui/icon";
import { holdSwipe, releaseSwipe } from "@/components/ui/swipe-hold";
import { Radius } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { dropSlot, slotsWhileDragging } from "@/lib/reorder";

export type ReorderItem = { rowKey: string; name: string };

const ROW_GAP = 2;
const DEFAULT_ROW_HEIGHT = 56;
const LONG_PRESS_MS = 350;
const SETTLE = { duration: 220, easing: Easing.out(Easing.cubic) };
const LIFT_SCALE = 1.03;
const HANDLE_WIDTH = 36;

type Drag = { key: string; from: number; to: number; order: string };

const slotsOf = (keys: readonly string[]) => Object.fromEntries(keys.map((key, index) => [key, index]));

type DragControls = {
  begin: (key: string) => void;
  follow: (key: string, offset: number) => void;
  drop: (key: string) => void;
};

function Handle({ name, index, count, controls, itemKey, onMove }: { name: string; index: number; count: number; controls: DragControls; itemKey: string; onMove: (from: number, to: number) => void }) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  const pointing = useRef(false);
  const pan = usePanGesture({
    minDistance: 1,
    runOnJS: true,
    onBegin: () => {
      pointing.current = true;
      setFocused(false);
      holdSwipe();
    },
    onActivate: () => controls.begin(itemKey),
    onUpdate: (event) => controls.follow(itemKey, event.translationY),
    onDeactivate: () => controls.drop(itemKey),
    onFinalize: () => {
      pointing.current = false;
      releaseSwipe();
    },
  });
  const step = (by: -1 | 1) => {
    const to = index + by;
    if (to >= 0 && to < count) onMove(index, to);
  };
  return (
    <GestureDetector gesture={pan} touchAction="none">
      <View
        role="button"
        aria-label={`Move ${name}, ${index + 1} of ${count}. Drag, or use the arrow keys`}
        accessibilityActions={[
          { name: "moveUp", label: "Move up" },
          { name: "moveDown", label: "Move down" },
        ]}
        onAccessibilityAction={(event) => step(event.nativeEvent.actionName === "moveUp" ? -1 : 1)}
        tabIndex={0}
        onKeyDown={(event: KeyDownEvent) => {
          const key = event.nativeEvent.key;
          if (key !== "ArrowUp" && key !== "ArrowDown") return;
          event.preventDefault();
          step(key === "ArrowUp" ? -1 : 1);
        }}
        onFocus={() => setFocused(!pointing.current)}
        onBlur={() => setFocused(false)}
        testID={`drag-handle-${index}`}
        style={[styles.handle, { borderColor: focused ? theme.text : "transparent" }]}
      >
        <Icon name="grip" size={20} color="textTertiary" />
      </View>
    </GestureDetector>
  );
}

function Slot({
  item,
  index,
  count,
  step,
  positions,
  active,
  offset,
  controls,
  canDrag,
  onMove,
  onHeight,
  renderRow,
}: {
  item: ReorderItem;
  index: number;
  count: number;
  step: number;
  positions: SharedValue<Record<string, number>>;
  active: SharedValue<string | null>;
  offset: SharedValue<number>;
  controls: DragControls;
  canDrag: boolean;
  onMove: (from: number, to: number) => void;
  onHeight: (height: number) => void;
  renderRow: (handle: ReactNode) => ReactNode;
}) {
  const theme = useTheme();
  const key = item.rowKey;
  const hold = usePanGesture({
    enabled: canDrag,
    activateAfterLongPress: LONG_PRESS_MS,
    runOnJS: true,
    onActivate: () => {
      holdSwipe();
      controls.begin(key);
    },
    onUpdate: (event) => controls.follow(key, event.translationY),
    onDeactivate: () => {
      controls.drop(key);
      releaseSwipe();
    },
  });
  const place = useAnimatedStyle(() => {
    const dragging = active.get() === key;
    const slot = positions.get()[key] ?? index;
    if (dragging) return { top: index * step + offset.get(), zIndex: 2, transform: [{ scale: withTiming(LIFT_SCALE, SETTLE) }] };
    return { top: withTiming(slot * step, SETTLE), zIndex: 0, transform: [{ scale: withTiming(1, SETTLE) }] };
  });
  const lift = useAnimatedStyle(() => ({ opacity: withTiming(active.get() === key ? 1 : 0, SETTLE) }));
  return (
    <Animated.View style={[styles.slot, place]} onLayout={(event) => onHeight(event.nativeEvent.layout.height)} testID={`reorder-slot-${index}`}>
      <Animated.View pointerEvents="none" style={[styles.lift, { backgroundColor: theme.background }, lift]} />
      <GestureDetector gesture={hold} touchAction="pan-y">
        <View>{renderRow(canDrag ? <Handle name={item.name} index={index} count={count} controls={controls} itemKey={key} onMove={onMove} /> : null)}</View>
      </GestureDetector>
    </Animated.View>
  );
}

export function ReorderList<T extends ReorderItem>({
  items,
  canDrag,
  onMove,
  onDragging,
  onStale,
  renderRow,
}: {
  items: readonly T[];
  canDrag: boolean;
  onMove: (from: number, to: number) => void;
  onDragging: (dragging: boolean) => void;
  onStale: () => void;
  renderRow: (item: T, index: number, handle: ReactNode) => ReactNode;
}) {
  const [rowHeight, setRowHeight] = useState(DEFAULT_ROW_HEIGHT);
  const [dragging, setDragging] = useState(false);
  const step = rowHeight + ROW_GAP;
  const order = items.map((item) => item.rowKey);
  const orderKey = order.join("|");
  const positions = useSharedValue<Record<string, number>>(slotsOf(order));
  const active = useSharedValue<string | null>(null);
  const offset = useSharedValue(0);
  const drag = useRef<Drag | null>(null);
  const latest = useRef({ order, step, canDrag, onMove, onDragging, onStale });
  useEffect(() => {
    latest.current = { order, step, canDrag, onMove, onDragging, onStale };
  });
  useEffect(() => {
    if (dragging) return;
    positions.set(slotsOf(orderKey === "" ? [] : orderKey.split("|")));
  }, [orderKey, dragging, positions]);
  useEffect(
    () => () => {
      if (drag.current !== null) latest.current.onDragging(false);
    },
    [],
  );
  const controls = useMemo<DragControls>(() => ({
    begin: (key) => {
      const { order: keys, canDrag: allowed, onDragging: tell } = latest.current;
      const from = keys.indexOf(key);
      if (!allowed || from < 0 || drag.current !== null) return;
      drag.current = { key, from, to: from, order: keys.join("|") };
      offset.set(0);
      active.set(key);
      setDragging(true);
      tell(true);
    },
    follow: (key, dy) => {
      const current = drag.current;
      if (current === null || current.key !== key) return;
      const { order: keys, step: rowStep } = latest.current;
      offset.set(dy);
      const to = dropSlot(current.from, dy, rowStep, keys.length);
      if (to === current.to) return;
      current.to = to;
      const slots = slotsWhileDragging(keys.length, current.from, to);
      positions.set(Object.fromEntries(keys.map((itemKey, index) => [itemKey, slots[index]])));
    },
    drop: (key) => {
      const current = drag.current;
      if (current === null || current.key !== key) return;
      drag.current = null;
      active.set(null);
      setDragging(false);
      const { onMove: move, onDragging: tell, onStale: stale, order: keys } = latest.current;
      tell(false);
      if (current.to === current.from) return;
      if (keys.join("|") !== current.order) stale();
      else move(current.from, current.to);
    },
  }), [active, offset, positions]);
  const height = items.length === 0 ? 0 : items.length * rowHeight + (items.length - 1) * ROW_GAP;
  return (
    <View style={{ height }} testID="reorder-list">
      {items.map((item, index) => (
        <Slot
          key={item.rowKey}
          item={item}
          index={index}
          count={items.length}
          step={step}
          positions={positions}
          active={active}
          offset={offset}
          controls={controls}
          canDrag={canDrag}
          onMove={onMove}
          onHeight={(measured) => {
            if (measured > rowHeight) setRowHeight(measured);
          }}
          renderRow={(handle) => renderRow(item, index, handle)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  slot: { position: "absolute", left: 0, right: 0 },
  lift: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderRadius: Radius.md,
    boxShadow: "0 6px 18px rgba(0, 0, 0, 0.22)",
  },
  handle: { width: HANDLE_WIDTH, height: 44, alignItems: "center", justifyContent: "center", borderRadius: Radius.sm, borderWidth: 2, marginLeft: 2, marginRight: -6 },
});
