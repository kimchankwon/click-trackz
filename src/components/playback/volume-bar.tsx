import { useState } from "react";
import { StyleSheet, View, type GestureResponderEvent, type KeyDownEvent } from "react-native";

import { ThemedText } from "@/components/themed-text";
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
};

export function VolumeBar({ label, value, onChange, testID, valueText, accessibleName, accessibleRange }: Props) {
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
      <ThemedText type="small" themeColor="textSecondary" style={styles.label}>
        {label}
      </ThemedText>
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
        style={[styles.track, { backgroundColor: theme.backgroundElement, borderColor: focused ? theme.text : "transparent" }]}
      >
        <View
          pointerEvents="none"
          style={[styles.fill, { width: `${value * 100}%`, backgroundColor: theme.accent }]}
        />
      </View>
      <ThemedText type="small" themeColor="textSecondary" style={styles.value}>
        {valueText ?? Math.round(value * 100)}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: Spacing.three, width: "100%" },
  label: { width: 56 },
  track: { flex: 1, height: 28, borderRadius: Spacing.two, borderWidth: 2, overflow: "hidden", justifyContent: "center" },
  fill: { height: "100%", borderRadius: Spacing.two },
  value: { minWidth: 32, textAlign: "right" },
});
