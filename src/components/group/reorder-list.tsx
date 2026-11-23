import { useEffect, useMemo, useRef, useState, type ComponentRef, type ReactNode } from "react";
import { StyleSheet, View, type KeyDownEvent } from "react-native";
import { GestureDetector, GestureStateManager, usePanGesture, type GestureTouchEvent } from "react-native-gesture-handler";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from "react-native-reanimated";

import { Icon } from "@/components/ui/icon";
import { holdSwipe, releaseSwipe } from "@/components/ui/swipe-hold";
import { Radius } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { wallClockNow } from "@/lib/device-clock";
import { beginDrag, endDrag, HOLD_MS, holdDecision, moveHold, ownsDrag, startHold, type DragOwner, type DragSession, type Hold } from "@/lib/drag-session";
import { dropSlot, slotsWhileDragging } from "@/lib/reorder";

type ReorderItem = { rowKey: string; name: string };

const ROW_GAP = 2;
const DEFAULT_ROW_HEIGHT = 56;
const SETTLE = { duration: 220, easing: Easing.out(Easing.cubic) };
const LIFT_SCALE = 1.03;
const HANDLE_WIDTH = 36;

const slotsOf = (keys: readonly string[]) => Object.fromEntries(keys.map((key, index) => [key, index]));

type DragControls = {
  begin: (key: string, owner: DragOwner) => boolean;
  follow: (key: string, owner: DragOwner, offset: number) => void;
  end: (key: string, owner: DragOwner, canceled: boolean) => void;
};

type Press = { hold: Hold; startTop: number | null; timer: ReturnType<typeof setTimeout> };

const touchOf = (event: GestureTouchEvent) => event.allTouches[0] ?? event.changedTouches[0];

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
    onActivate: () => {
      controls.begin(itemKey, "handle");
    },
    onUpdate: (event) => controls.follow(itemKey, "handle", event.translationY),
    onFinalize: (event) => {
      controls.end(itemKey, "handle", event.canceled);
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
  const row = useRef<ComponentRef<typeof View>>(null);
  const press = useRef<Press | null>(null);
  const swipeHeldHere = useRef(false);
  const letGo = () => {
    if (press.current !== null) clearTimeout(press.current.timer);
    press.current = null;
  };
  const decide = (handlerTag: number, rowTop: number | null) => {
    const current = press.current;
    if (current === null) return;
    const rowShift = current.startTop === null || rowTop === null ? 0 : rowTop - current.startTop;
    const decision = holdDecision(current.hold, wallClockNow(), rowShift);
    if (decision === "wait") return;
    letGo();
    if (decision === "fail" || !controls.begin(key, "hold")) {
      GestureStateManager.fail(handlerTag);
      return;
    }
    holdSwipe();
    swipeHeldHere.current = true;
    GestureStateManager.activate(handlerTag);
  };
  const measureTop = (then: (top: number | null) => void) => {
    const view = row.current;
    if (view === null) then(null);
    else view.measureInWindow((_x, y) => then(Number.isFinite(y) ? y : null));
  };
  useEffect(() => letGo, []);
  const hold = usePanGesture({
    enabled: canDrag,
    manualActivation: true,
    runOnJS: true,
    onTouchesDown: (event) => {
      const touch = touchOf(event);
      letGo();
      if (touch === undefined || event.numberOfTouches > 1) return;
      const handlerTag = event.handlerTag;
      const timer = setTimeout(() => measureTop((top) => decide(handlerTag, top)), HOLD_MS);
      const started: Press = { hold: startHold(touch.absoluteX, touch.absoluteY, wallClockNow()), startTop: null, timer };
      press.current = started;
      measureTop((top) => {
        if (press.current === started) started.startTop = top;
      });
    },
    onTouchesMove: (event) => {
      const current = press.current;
      const touch = touchOf(event);
      if (current === null || touch === undefined) return;
      current.hold = moveHold(current.hold, touch.absoluteX, touch.absoluteY);
      decide(event.handlerTag, null);
    },
    onTouchesUp: letGo,
    onTouchesCancel: letGo,
    onUpdate: (event) => controls.follow(key, "hold", event.translationY),
    onFinalize: (event) => {
      letGo();
      controls.end(key, "hold", event.canceled);
      if (swipeHeldHere.current) releaseSwipe();
      swipeHeldHere.current = false;
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
        <View ref={row}>{renderRow(canDrag ? <Handle name={item.name} index={index} count={count} controls={controls} itemKey={key} onMove={onMove} /> : null)}</View>
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
  const drag = useRef<DragSession | null>(null);
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
    begin: (key, owner) => {
      const { order: keys, canDrag: allowed, onDragging: tell } = latest.current;
      const session = beginDrag(drag.current, key, owner, keys, allowed);
      if (session === null) return false;
      drag.current = session;
      offset.set(0);
      active.set(key);
      setDragging(true);
      tell(true);
      return true;
    },
    follow: (key, owner, dy) => {
      const current = drag.current;
      if (!ownsDrag(current, key, owner)) return;
      const { order: keys, step: rowStep } = latest.current;
      offset.set(dy);
      const to = dropSlot(current.from, dy, rowStep, keys.length);
      if (to === current.to) return;
      current.to = to;
      const slots = slotsWhileDragging(keys.length, current.from, to);
      positions.set(Object.fromEntries(keys.map((itemKey, index) => [itemKey, slots[index]])));
    },
    end: (key, owner, canceled) => {
      const { onMove: move, onDragging: tell, onStale: stale, order: keys } = latest.current;
      const outcome = endDrag(drag.current, key, owner, canceled, keys);
      if (outcome.kind === "ignore") return;
      drag.current = null;
      active.set(null);
      setDragging(false);
      tell(false);
      if (outcome.kind === "stale") stale();
      else if (outcome.kind === "move") move(outcome.from, outcome.to);
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
