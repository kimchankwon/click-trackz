import { Pressable, StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { Radius } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
  testID,
}: {
  label: string;
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (next: T) => void;
  testID?: string;
}) {
  const theme = useTheme();
  return (
    <View role="radiogroup" aria-label={label} testID={testID} style={[styles.track, { backgroundColor: theme.backgroundSelected }]}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            role="radio"
            aria-checked={selected}
            onPress={() => onChange(option.value)}
            style={[styles.segment, selected ? [styles.raised, { backgroundColor: theme.raised }] : null]}
          >
            <ThemedText type="smallBold" themeColor={selected ? "text" : "textSecondary"} numberOfLines={1}>
              {option.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { flexDirection: "row", borderRadius: Radius.md, padding: 3, gap: 3, alignSelf: "stretch" },
  segment: { flex: 1, minHeight: 40, alignItems: "center", justifyContent: "center", borderRadius: Radius.sm, paddingHorizontal: 8 },
  raised: { boxShadow: "0 1px 3px rgba(0, 0, 0, 0.18)" },
});
