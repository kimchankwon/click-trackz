import { StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { SignalBars } from "@/components/ui/signal-bars";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import type { ConnectionStatus } from "@/lib/connection-status";
import { useConnectionStatus } from "@/lib/use-connected";

const LABELS: Record<ConnectionStatus, string> = { online: "Online", connecting: "Connecting…", offline: "Offline" };

export function ConnectionBadge({ roundTripMs = null }: { roundTripMs?: number | null }) {
  const theme = useTheme();
  const status = useConnectionStatus();
  const dot = status === "online" ? theme.switchOn : status === "offline" ? theme.warningText : theme.dotInactive;
  const ping = status === "online" && roundTripMs !== null ? Math.round(roundTripMs) : null;
  return (
    <View style={styles.badge} testID="connection-status" accessibilityLabel={ping === null ? LABELS[status] : `${LABELS[status]}, ping ${ping} ms`}>
      <View style={[styles.dot, { backgroundColor: dot }]} />
      <ThemedText type="smallBold" themeColor={status === "offline" ? "warningText" : "textSecondary"} testID={`connection-${status}`}>
        {LABELS[status]}
      </ThemedText>
      {ping === null ? null : (
        <View style={styles.ping} testID="connection-ping">
          <SignalBars roundTripMs={roundTripMs} />
          <ThemedText type="smallBold" themeColor="textSecondary">
            {`${ping} ms`}
          </ThemedText>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { flexDirection: "row", alignItems: "center", gap: Spacing.one + 2 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  ping: { flexDirection: "row", alignItems: "center", gap: Spacing.one, marginLeft: Spacing.one },
});
