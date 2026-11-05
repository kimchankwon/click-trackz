import { Pressable, StyleSheet } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { Icon, type IconName } from "@/components/ui/icon";
import { Radius, Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

export function Chip({
  label,
  selected,
  onPress,
  role = "switch",
  testID,
  icon,
  disabled,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  role?: "switch" | "radio" | "button";
  testID?: string;
  icon?: IconName;
  disabled?: boolean;
}) {
  const theme = useTheme();
  const showCheck = selected && role !== "button";
  const leading = showCheck ? "check" : icon;
  return (
    <Pressable
      role={role}
      aria-checked={role === "button" ? undefined : selected}
      aria-pressed={role === "button" ? selected : undefined}
      testID={testID}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected ? theme.accentTint : theme.backgroundSelected,
          borderColor: selected ? theme.accent : "transparent",
        },
        pressed ? styles.pressed : null,
      ]}
    >
      {leading ? <Icon name={leading} size={16} color={selected ? "accent" : "textSecondary"} /> : null}
      <ThemedText type="default" themeColor={selected ? "accent" : "text"} style={selected ? styles.selectedLabel : styles.label}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.one + 2,
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: Radius.pill,
    borderWidth: 1.5,
  },
  pressed: { opacity: 0.7 },
  label: { fontSize: 15, lineHeight: 20, fontWeight: 500 },
  selectedLabel: { fontSize: 15, lineHeight: 20, fontWeight: 600 },
});
