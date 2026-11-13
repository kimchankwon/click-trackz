import { Redirect, router, Stack, type ErrorBoundaryProps } from "expo-router";
import { Pressable, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useSignedInHere } from "@/auth/use-signed-in-here";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { errorText } from "@/lib/error-text";
import { useStaleAppRecovery } from "@/lib/use-stale-app-recovery";

export default function GroupLayout() {
  const { signedIn, settling } = useSignedInHere();
  if (settling) return <ThemedView style={styles.container} />;
  if (!signedIn) return <Redirect href="/" />;
  return <Stack screenOptions={{ headerShown: false, fullScreenGestureEnabled: false }} />;
}

export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const theme = useTheme();
  const updating = useStaleAppRecovery(error);
  if (updating) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.content}>
          <ThemedText themeColor="textSecondary" testID="updating-app">
            Updating to the latest version…
          </ThemedText>
        </SafeAreaView>
      </ThemedView>
    );
  }
  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.content}>
        <ThemedText type="subtitle">Cannot open this Group</ThemedText>
        <ThemedText themeColor="textSecondary" testID="group-error">
          {errorText(error)}
        </ThemedText>
        <Pressable
          role="button"
          testID="back-to-groups"
          onPress={() => router.dismissTo("/")}
          style={[styles.button, { backgroundColor: theme.accent }]}
        >
          <ThemedText style={{ color: theme.onAccent }}>Back to your Groups</ThemedText>
        </Pressable>
        <Pressable role="button" onPress={retry}>
          <ThemedText type="small" themeColor="textSecondary">
            Try again
          </ThemedText>
        </Pressable>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, justifyContent: "center", alignItems: "center", gap: Spacing.three, padding: Spacing.four },
  button: { paddingHorizontal: Spacing.four, paddingVertical: Spacing.three, borderRadius: Spacing.three },
});
