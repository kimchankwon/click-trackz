import { useState } from "react";
import { StyleSheet, View, type GestureResponderEvent } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

const STEP = 0.1;
const clamp = (value: number) => Math.min(1, Math.max(0, value));

type Props = {
  label: string;
  value: number;
  onChange: (next: number) => void;
  testID?: string;
};

export function VolumeBar({ label, value, onChange, testID }: Props) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);
  const setFromTouch = (event: GestureResponderEvent) => {
    if (width > 0) onChange(clamp(event.nativeEvent.locationX / width));
  };
  return (
    <View style={styles.row}>
      <ThemedText type="small" themeColor="textSecondary" style={styles.label}>
        {label}
      </ThemedText>
      <View
        testID={testID}
        role="slider"
        aria-label={`${label} volume`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(value * 100)}
        accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
        onAccessibilityAction={(event) =>
          onChange(clamp(value + (event.nativeEvent.actionName === "increment" ? STEP : -STEP)))
        }
        onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={setFromTouch}
        onResponderMove={setFromTouch}
        style={[styles.track, { backgroundColor: theme.backgroundElement }]}
      >
        <View
          pointerEvents="none"
          style={[styles.fill, { width: `${value * 100}%`, backgroundColor: theme.accent }]}
        />
      </View>
      <ThemedText type="small" themeColor="textSecondary" style={styles.value}>
        {Math.round(value * 100)}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: Spacing.three, width: "100%" },
  label: { width: 56 },
  track: { flex: 1, height: 28, borderRadius: Spacing.two, overflow: "hidden", justifyContent: "center" },
  fill: { height: "100%", borderRadius: Spacing.two },
  value: { width: 32, textAlign: "right" },
});
