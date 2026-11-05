import { Pressable, StyleSheet } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

type Props = {
  label: string;
  onPress: () => void;
  testID?: string;
  accent?: boolean;
  small?: boolean;
};

export function ActionButton({ label, onPress, testID, accent, small }: Props) {
  const theme = useTheme();
  return (
    <Pressable
      role="button"
      testID={testID}
      onPress={onPress}
      style={[styles.button, { backgroundColor: accent ? theme.accent : theme.backgroundElement }]}
    >
      <ThemedText type={small ? "small" : "default"} style={accent ? { color: theme.onAccent } : null}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, borderRadius: Spacing.three },
});
