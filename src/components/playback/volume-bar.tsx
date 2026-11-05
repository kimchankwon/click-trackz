import { useState } from "react";
import { StyleSheet, View, type GestureResponderEvent, type KeyDownEvent } from "react-native";

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
};

export function VolumeBar({ label, value, onChange, testID, valueText, accessibleName, accessibleRange, icon, hideValue, bare }: Props) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);
  const [focused, setFocused] = useState(false);
  const setFromTouch = (event: GestureResponderEvent) => {
    if (width > 0) onChange(clampVolume(event.nativeEvent.locationX / width));
  };
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
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={setFromTouch}
        onResponderMove={setFromTouch}
        {...keyboard}
        style={[styles.hitArea, { borderColor: focused ? theme.text : "transparent" }]}
      >
        <View pointerEvents="none" style={[styles.track, { backgroundColor: theme.backgroundSelected }]}>
          <View style={[styles.fill, { width: `${value * 100}%`, backgroundColor: theme.accent }]} />
        </View>
        <View
          pointerEvents="none"
          style={[styles.thumb, { left: Math.max(0, width - 32) * value, backgroundColor: theme.accent, borderColor: theme.background }]}
        />
      </View>
      {hideValue ? null : (
        <ThemedText type="smallBold" themeColor="textSecondary" style={styles.value}>
          {valueText ?? Math.round(value * 100)}
        </ThemedText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: Spacing.three, width: "100%" },
  label: { width: 52 },
  hitArea: { flex: 1, height: 44, justifyContent: "center", borderWidth: 2, borderRadius: 12, paddingHorizontal: 12, marginHorizontal: -12 },
  track: { height: 6, borderRadius: 3, overflow: "hidden" },
  fill: { height: "100%", borderRadius: 3 },
  thumb: { position: "absolute", width: 28, height: 28, borderRadius: 14, borderWidth: 3, boxShadow: "0 1px 3px rgba(0, 0, 0, 0.3)" },
  value: { minWidth: 40, textAlign: "right", fontSize: 15, fontWeight: 600, fontVariant: ["tabular-nums"] },
});
