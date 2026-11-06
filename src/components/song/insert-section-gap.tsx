import { Pressable, StyleSheet, View } from "react-native";

import { Icon } from "@/components/ui/icon";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

export function InsertSectionGap({ after, onPress }: { after: number; onPress: () => void }) {
  const theme = useTheme();
  return (
    <View style={styles.gap}>
      <View style={[styles.line, { backgroundColor: theme.border }]} />
      <Pressable
        role="button"
        aria-label={`Add a Section between Sections ${after} and ${after + 1}`}
        testID={`insert-section-${after}`}
        hitSlop={8}
        onPress={onPress}
        style={({ pressed }) => [styles.button, { backgroundColor: pressed ? theme.backgroundSelected : theme.background, borderColor: theme.border }]}
      >
        <Icon name="add" size={16} color="accent" />
      </Pressable>
      <View style={[styles.line, { backgroundColor: theme.border }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  gap: { flexDirection: "row", alignItems: "center", gap: Spacing.two, marginVertical: -Spacing.two },
  line: { flex: 1, height: StyleSheet.hairlineWidth },
  button: { width: 28, height: 28, borderRadius: 14, borderWidth: 1, alignItems: "center", justifyContent: "center" },
});
