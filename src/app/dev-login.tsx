import { useAuthActions } from "@convex-dev/auth/react";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, TextInput } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

const enabled = process.env.EXPO_PUBLIC_DEV_LOGIN === "1";

export default function DevLoginScreen() {
  const { signIn } = useAuthActions();
  const theme = useTheme();
  const [email, setEmail] = useState("admin@example.com");
  const [secret, setSecret] = useState("");
  const [error, setError] = useState<string | null>(null);
  if (!enabled) return null;
  const input = [styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }];
  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedText type="subtitle">Dev login</ThemedText>
        <TextInput testID="dev-email" style={input} value={email} onChangeText={setEmail} autoCapitalize="none" />
        <TextInput testID="dev-secret" style={input} value={secret} onChangeText={setSecret} secureTextEntry />
        <Pressable
          role="button"
          testID="dev-submit"
          style={[styles.button, { backgroundColor: theme.accent }]}
          onPress={() =>
            signIn("dev", { email, secret })
              .then(() => router.replace("/"))
              .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
          }
        >
          <ThemedText style={{ color: theme.onAccent }}>Sign in</ThemedText>
        </Pressable>
        {error ? <ThemedText themeColor="textSecondary">{error}</ThemedText> : null}
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, padding: Spacing.four, gap: Spacing.three, justifyContent: "center" },
  input: { padding: Spacing.three, borderRadius: Spacing.three, fontSize: 16 },
  button: { padding: Spacing.three, borderRadius: Spacing.three, alignItems: "center" },
});
