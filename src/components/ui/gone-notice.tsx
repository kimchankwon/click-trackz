import { Pressable, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

export function GoneNotice({ title, message, action, onPress, testID }: { title: string; message: string; action: string; onPress: () => void; testID: string }) {
  const theme = useTheme();
  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.content}>
        <ThemedText type="subtitle" style={styles.centered}>
          {title}
        </ThemedText>
        <ThemedText themeColor="textSecondary" testID={testID} style={styles.centered}>
          {message}
        </ThemedText>
        <Pressable role="button" testID={`${testID}-back`} onPress={onPress} style={[styles.button, { backgroundColor: theme.accent }]}>
          <ThemedText style={{ color: theme.onAccent }}>{action}</ThemedText>
        </Pressable>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, justifyContent: "center", alignItems: "center", gap: Spacing.three, padding: Spacing.four },
  centered: { textAlign: "center" },
  button: { paddingHorizontal: Spacing.four, paddingVertical: Spacing.three, borderRadius: Spacing.three },
});
