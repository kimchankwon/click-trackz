import { ActivityIndicator, StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { Spacing } from "@/constants/theme";
import { useConnected } from "@/lib/use-connected";

export function Connecting() {
  const connected = useConnected();
  return (
    <View style={styles.wrap} testID="loading">
      <ActivityIndicator />
      {connected ? null : (
        <ThemedText type="small" themeColor="textSecondary" testID="connecting">
          Connecting…
        </ThemedText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({ wrap: { alignItems: "center", gap: Spacing.two } });
