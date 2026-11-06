import { useState } from "react";
import { StyleSheet, View, type KeyDownEvent } from "react-native";
import { GestureDetector, usePanGesture } from "react-native-gesture-handler";

import { ThemedText } from "@/components/themed-text";
import { Icon, type IconName } from "@/components/ui/icon";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

import { VOLUME_STEP, clampVolume, volumeForKey } from "./volume-keys";

type Props = {
  label: string;
  value: number;
  onChange: (next: number) => void;
  testID?: string;
  valueText?: string;
  accessibleName?: string;
  accessibleRange?: { min: number; max: number; now: number };
  icon?: IconName;
  hideValue?: boolean;
  bare?: boolean;
  origin?: number;
};

export function VolumeBar({ label, value, onChange, testID, valueText, accessibleName, accessibleRange, icon, hideValue, bare, origin = 0 }: Props) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);
  const [focused, setFocused] = useState(false);
  const travel = Math.max(0, width - THUMB_INSET * 2);
  const setFromX = (x: number) => {
    if (travel > 0) onChange(clampVolume((x - THUMB_INSET) / travel));
  };
  const drag = usePanGesture({
    minDistance: 0,
    runOnJS: true,
    onBegin: (event) => setFromX(event.x),
    onUpdate: (event) => setFromX(event.x),
  });
  const keyboard = {
    tabIndex: 0 as const,
    onKeyDown: (event: KeyDownEvent) => {
      const next = volumeForKey(value, event.nativeEvent.key);
      if (next === null) return;
      event.preventDefault();
      onChange(next);
    },
    onFocus: () => setFocused(true),
    onBlur: () => setFocused(false),
  };
  return (
    <View style={styles.row}>
      {icon ? <Icon name={icon} size={20} color="textSecondary" /> : null}
      {bare ? null : (
        <ThemedText type="smallBold" style={styles.label}>
          {label}
        </ThemedText>
      )}
      <GestureDetector gesture={drag} touchAction="pan-y">
        <View
          testID={testID}
          role="slider"
          aria-label={accessibleName ?? `${label} volume`}
          aria-valuemin={accessibleRange?.min ?? 0}
          aria-valuemax={accessibleRange?.max ?? 100}
          aria-valuenow={accessibleRange?.now ?? Math.round(value * 100)}
          aria-valuetext={valueText}
          accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
          onAccessibilityAction={(event) =>
            onChange(clampVolume(value + (event.nativeEvent.actionName === "increment" ? VOLUME_STEP : -VOLUME_STEP)))
          }
          onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
          {...keyboard}
          style={[styles.hitArea, { borderColor: focused ? theme.text : "transparent" }]}
        >
          <View pointerEvents="none" style={[styles.track, { backgroundColor: theme.backgroundSelected }]}>
            <View
              style={[
                styles.fill,
                { left: `${Math.min(origin, value) * 100}%`, width: `${Math.abs(value - origin) * 100}%`, backgroundColor: theme.accent },
              ]}
            />
          </View>
          {origin > 0 ? (
            <View pointerEvents="none" style={[styles.originTick, { left: THUMB_INSET - BORDER - 1 + travel * origin, backgroundColor: theme.textTertiary }]} />
          ) : null}
          <View
            pointerEvents="none"
            style={[styles.thumb, { left: THUMB_INSET - BORDER - THUMB / 2 + travel * value, backgroundColor: theme.accent, borderColor: theme.background }]}
          />
        </View>
      </GestureDetector>
      {hideValue ? null : (
        <ThemedText type="smallBold" themeColor="textSecondary" style={styles.value}>
          {valueText ?? Math.round(value * 100)}
        </ThemedText>
      )}
    </View>
  );
}

const BORDER = 2;
const THUMB = 28;
const THUMB_INSET = 16;

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: Spacing.three, width: "100%" },
  label: { width: 52 },
  hitArea: { flex: 1, height: 44, justifyContent: "center", borderWidth: 2, borderRadius: 12, paddingHorizontal: 12, marginHorizontal: -12 },
  track: { height: 6, borderRadius: 3, overflow: "hidden", marginHorizontal: THUMB_INSET - BORDER - 12 },
  fill: { position: "absolute", top: 0, bottom: 0, borderRadius: 3 },
  originTick: { position: "absolute", bottom: 4, width: 2, height: 12, borderRadius: 1 },
  thumb: { position: "absolute", width: THUMB, height: THUMB, borderRadius: THUMB / 2, borderWidth: 3, boxShadow: "0 1px 3px rgba(0, 0, 0, 0.3)" },
  value: { minWidth: 40, textAlign: "right", fontSize: 15, fontWeight: 600, fontVariant: ["tabular-nums"] },
});
