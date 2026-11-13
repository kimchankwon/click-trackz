import { StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import type { ConnectionStatus } from "@/lib/connection-status";
import { useConnectionStatus } from "@/lib/use-connected";

const LABELS: Record<ConnectionStatus, string> = { online: "Online", connecting: "Connecting…", offline: "Offline" };

export function ConnectionBadge() {
  const theme = useTheme();
  const status = useConnectionStatus();
  const dot = status === "online" ? theme.switchOn : status === "offline" ? theme.warningText : theme.dotInactive;
  return (
    <View style={styles.badge} testID="connection-status" accessibilityLabel={LABELS[status]}>
      <View style={[styles.dot, { backgroundColor: dot }]} />
      <ThemedText type="smallBold" themeColor={status === "offline" ? "warningText" : "textSecondary"} testID={`connection-${status}`}>
        {LABELS[status]}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { flexDirection: "row", alignItems: "center", gap: Spacing.one + 2 },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
