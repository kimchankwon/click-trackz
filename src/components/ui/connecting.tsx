import { ActivityIndicator, StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { Spacing } from "@/constants/theme";
import { useConnectionStatus } from "@/lib/use-connected";

export function Connecting() {
  const status = useConnectionStatus();
  return (
    <View style={styles.wrap} testID="loading">
      <ActivityIndicator />
      {status === "online" ? null : (
        <ThemedText type="small" themeColor="textSecondary" testID="connecting" style={styles.centered}>
          {status === "offline" ? "Offline. Still trying to connect…" : "Connecting…"}
        </ThemedText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({ wrap: { alignItems: "center", gap: Spacing.two }, centered: { textAlign: "center" } });
