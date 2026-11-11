import { router } from "expo-router";
import { StyleSheet, View } from "react-native";

import { ActionButton } from "@/components/action-button";
import { ThemedText } from "@/components/themed-text";
import { Icon } from "@/components/ui/icon";
import { Radius, Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

export function LockedNotice({ isAdmin }: { isAdmin: boolean }) {
  const theme = useTheme();
  return (
    <View style={[styles.notice, { backgroundColor: theme.backgroundSelected }]} testID="locked-notice" role="alert">
      <View style={styles.row}>
        <Icon name="warning" size={18} color="textSecondary" />
        <ThemedText type="smallBold">This Group is locked</ThemedText>
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        {isAdmin
          ? "Your subscription no longer covers this Group, so it cannot play or change. Renew or upgrade to open it again."
          : "Its Admin's subscription no longer covers it, so it cannot play or change until they renew."}
      </ThemedText>
      {isAdmin ? <ActionButton label="See plans" icon="star" small testID="locked-see-plans" onPress={() => router.push("/subscribe")} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  notice: { gap: Spacing.two, padding: Spacing.three, borderRadius: Radius.md },
  row: { flexDirection: "row", alignItems: "center", gap: Spacing.one },
});
