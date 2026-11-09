import { Pressable, StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { useTheme } from "@/hooks/use-theme";

export const SECTION_CHIP_SIZE = 54;

export const sectionChipFontSize = (label: string) => (label.length <= 2 ? 17 : label.length === 3 ? 15 : label.length === 4 ? 13 : 12);

export function SectionChip({
  label,
  plays,
  selected,
  queued,
  accessibleName,
  testID,
  onPress,
}: {
  label: string;
  plays: number;
  selected: boolean;
  queued: boolean;
  accessibleName: string;
  testID: string;
  onPress: () => void;
}) {
  const theme = useTheme();
  const fontSize = sectionChipFontSize(label);
  return (
    <Pressable
      role="button"
      aria-label={accessibleName}
      aria-pressed={selected}
      testID={testID}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected ? theme.accent : theme.backgroundSelected,
          borderColor: queued ? (selected ? theme.text : theme.accent) : selected ? theme.accent : "transparent",
          borderWidth: queued ? 3 : 1.5,
        },
        pressed ? styles.pressed : null,
      ]}
    >
      <ThemedText
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.6}
        themeColor={selected ? "onAccent" : "text"}
        style={[styles.label, { fontSize, lineHeight: fontSize + 4 }]}
      >
        {label}
      </ThemedText>
      {plays > 1 ? (
        <View
          testID={`${testID}-plays`}
          style={[styles.badge, { backgroundColor: selected ? theme.text : theme.accent, borderColor: theme.backgroundElement }]}
        >
          <ThemedText style={[styles.badgeText, { color: selected ? theme.background : theme.onAccent }]}>{plays}</ThemedText>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    width: SECTION_CHIP_SIZE,
    height: SECTION_CHIP_SIZE,
    borderRadius: SECTION_CHIP_SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  pressed: { opacity: 0.7 },
  label: { fontWeight: 700, textAlign: "center" },
  badge: {
    position: "absolute",
    top: -5,
    right: -5,
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    paddingHorizontal: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { fontSize: 12, lineHeight: 15, fontWeight: 700, fontVariant: ["tabular-nums"] },
});
