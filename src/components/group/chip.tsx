import { Pressable, StyleSheet } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

export function Chip({
  label,
  selected,
  onPress,
  role = "switch",
  testID,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  role?: "switch" | "button";
  testID?: string;
}) {
  const theme = useTheme();
  return (
    <Pressable
      role={role}
      aria-checked={role === "switch" ? selected : undefined}
      testID={testID}
      onPress={onPress}
      style={[styles.chip, { backgroundColor: selected ? theme.accent : theme.backgroundElement }]}
    >
      <ThemedText type="smallBold" style={selected ? { color: theme.onAccent } : null}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, borderRadius: Spacing.five },
});
