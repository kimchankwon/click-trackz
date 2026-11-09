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
  strong,
  compact,
  queued,
  accessibleName,
  badge,
}: {
  badge?: string;
  strong?: boolean;
  compact?: boolean;
  queued?: boolean;
  accessibleName?: string;
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
      aria-label={accessibleName}
      aria-checked={role === "button" ? undefined : selected}
      aria-pressed={role === "button" ? selected : undefined}
      testID={testID}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected ? (strong ? theme.accent : theme.accentTint) : theme.backgroundSelected,
          borderColor: queued ? (selected ? theme.text : theme.accent) : selected ? theme.accent : "transparent",
        },
        strong ? styles.strongChip : null,
        compact ? styles.compactChip : null,
        queued ? styles.queuedChip : null,
        pressed ? styles.pressed : null,
      ]}
    >
      {leading ? <Icon name={leading} size={16} color={selected ? (strong ? "onAccent" : "accent") : "textSecondary"} /> : null}
      <ThemedText type="default" themeColor={selected ? (strong ? "onAccent" : "accent") : "text"} style={selected ? styles.selectedLabel : styles.label}>
        {label}
      </ThemedText>
      {badge ? (
        <ThemedText themeColor={selected ? (strong ? "onAccent" : "accent") : "textSecondary"} style={styles.badge}>
          {badge}
        </ThemedText>
      ) : null}
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
  strongChip: { minHeight: 48, paddingHorizontal: 20 },
  compactChip: { minHeight: 44, minWidth: 44, paddingHorizontal: Spacing.two, justifyContent: "center" },
  queuedChip: { borderWidth: 3 },
  label: { fontSize: 15, lineHeight: 20, fontWeight: 500 },
  selectedLabel: { fontSize: 15, lineHeight: 20, fontWeight: 600 },
  badge: { fontSize: 13, lineHeight: 18, fontWeight: 700, fontVariant: ["tabular-nums"], marginLeft: -2 },
});
