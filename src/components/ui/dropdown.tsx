import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { Icon } from "@/components/ui/icon";
import { Radius, Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

export function Dropdown<T extends string>({
  label,
  options,
  value,
  onChange,
  testID,
  disabled,
}: {
  label: string;
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (next: T) => void;
  testID?: string;
  disabled?: boolean;
}) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value);
  return (
    <View style={styles.wrap} testID={testID}>
      <Pressable
        role="button"
        aria-label={`${label}, ${selected?.label ?? value}`}
        aria-expanded={open}
        disabled={disabled}
        testID={testID ? `${testID}-button` : undefined}
        onPress={() => setOpen(!open)}
        style={({ pressed }) => [
          styles.button,
          { borderColor: theme.inputBorder, backgroundColor: pressed ? theme.backgroundSelected : theme.background },
          disabled ? styles.disabled : null,
        ]}
      >
        <ThemedText type="smallBold" numberOfLines={1} style={styles.grow}>
          {selected?.label ?? value}
        </ThemedText>
        <Icon name={open ? "up" : "down"} size={16} color="textSecondary" />
      </Pressable>
      {open ? (
        <View role="radiogroup" aria-label={label} style={[styles.list, { borderColor: theme.border, backgroundColor: theme.background }]}>
          {options.map((option, index) => {
            const chosen = option.value === value;
            return (
              <Pressable
                key={option.value}
                role="radio"
                aria-checked={chosen}
                testID={testID ? `${testID}-${option.value}` : undefined}
                onPress={() => {
                  setOpen(false);
                  if (!chosen) onChange(option.value);
                }}
                style={({ pressed }) => [
                  styles.option,
                  index > 0 ? { borderTopColor: theme.border, borderTopWidth: StyleSheet.hairlineWidth } : null,
                  pressed ? { backgroundColor: theme.backgroundSelected } : null,
                ]}
              >
                <ThemedText type="small" themeColor={chosen ? "accent" : "text"} style={styles.grow}>
                  {option.label}
                </ThemedText>
                {chosen ? <Icon name="check" size={16} color="accent" /> : null}
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.one, alignSelf: "stretch" },
  button: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
    minHeight: 40,
    paddingHorizontal: Spacing.three,
    borderWidth: 1,
    borderRadius: Radius.md,
  },
  list: { borderWidth: 1, borderRadius: Radius.md, overflow: "hidden" },
  option: { flexDirection: "row", alignItems: "center", gap: Spacing.two, minHeight: 44, paddingHorizontal: Spacing.three },
  disabled: { opacity: 0.5 },
  grow: { flex: 1, minWidth: 0 },
});
