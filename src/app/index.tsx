import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth, useQuery } from "convex/react";
import { router } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { MaxContentWidth, Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { api } from "../../convex/_generated/api";

export default function HomeScreen() {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const viewer = useQuery(api.users.viewer, isAuthenticated ? {} : "skip");
  const { signIn, signOut } = useAuthActions();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const theme = useTheme();

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedText type="title" style={styles.title}>
          Cue Tracker
        </ThemedText>
        {isLoading || busy ? (
          <ActivityIndicator />
        ) : isAuthenticated ? (
          <>
            <ThemedText testID="viewer-status">
              {viewer ? `Signed in${viewer.isAnonymous ? " as a guest" : ""}` : "Loading…"}
            </ThemedText>
            <Pressable
              accessibilityRole="link"
              testID="open-playback"
              style={[styles.button, { backgroundColor: theme.backgroundElement }]}
              onPress={() => router.push("/playback")}
            >
              <ThemedText>Open Playback</ThemedText>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              style={[styles.button, { backgroundColor: theme.backgroundElement }]}
              onPress={() => run(signOut)}
            >
              <ThemedText>Sign out</ThemedText>
            </Pressable>
          </>
        ) : (
          <Pressable
            accessibilityRole="button"
            style={[styles.button, { backgroundColor: theme.backgroundElement }]}
            onPress={() => run(() => signIn("anonymous"))}
          >
            <ThemedText>Continue as guest</ThemedText>
          </Pressable>
        )}
        {error ? <ThemedText themeColor="textSecondary">{error}</ThemedText> : null}
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
  },
  safeArea: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.four,
    paddingHorizontal: Spacing.four,
    maxWidth: MaxContentWidth,
  },
  title: {
    textAlign: "center",
  },
  button: {
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    borderRadius: Spacing.three,
  },
});
