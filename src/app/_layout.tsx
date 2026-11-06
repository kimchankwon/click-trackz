import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { DarkTheme, DefaultTheme, Stack, ThemeProvider, type ErrorBoundaryProps } from "expo-router";
import { Pressable, StyleSheet, useColorScheme, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { claimReturnedGoogleCode } from "@/auth/pending-google";
import { ThemedText } from "@/components/themed-text";
import { UpdateBanner } from "@/components/update-banner";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { authStorage, convex } from "@/lib/convex";
import { errorText } from "@/lib/error-text";
import { useStaleAppRecovery } from "@/lib/use-stale-app-recovery";
import { AccentSync } from "@/theme/accent-sync";

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <GestureHandlerRootView style={styles.root}>
      <ConvexAuthProvider client={convex} storage={authStorage} shouldHandleCode={claimReturnedGoogleCode}>
        <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
          <AccentSync />
          <Stack screenOptions={{ headerShown: false, fullScreenGestureEnabled: false }} />
          <UpdateBanner />
        </ThemeProvider>
      </ConvexAuthProvider>
    </GestureHandlerRootView>
  );
}

export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const theme = useTheme();
  const updating = useStaleAppRecovery(error);
  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {updating ? (
        <ThemedText themeColor="textSecondary" testID="updating-app">
          Updating to the latest version…
        </ThemedText>
      ) : (
        <>
          <ThemedText type="subtitle">Something went wrong</ThemedText>
          <ThemedText themeColor="textSecondary" testID="app-error">
            {errorText(error)}
          </ThemedText>
          <Pressable role="button" onPress={retry} style={[styles.button, { backgroundColor: theme.accent }]}>
            <ThemedText style={{ color: theme.onAccent }}>Try again</ThemedText>
          </Pressable>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  container: { flex: 1, justifyContent: "center", alignItems: "center", gap: Spacing.three, padding: Spacing.four },
  button: { paddingHorizontal: Spacing.four, paddingVertical: Spacing.three, borderRadius: Spacing.three },
});
