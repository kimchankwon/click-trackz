import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { IconButton } from "@/components/ui/icon-button";
import { Spacing } from "@/constants/theme";

export function ScreenHeader({
  title,
  subtitle,
  onBack,
  backLabel = "Back",
  backTestID = "back",
  right,
}: {
  title: string;
  subtitle?: ReactNode;
  onBack?: () => void;
  backLabel?: string;
  backTestID?: string;
  right?: ReactNode;
}) {
  return (
    <View style={styles.header}>
      {onBack ? <IconButton icon="back" label={backLabel} testID={backTestID} onPress={onBack} filled round /> : null}
      <View style={styles.titles}>
        <ThemedText type="heading" numberOfLines={1} role="heading">
          {title}
        </ThemedText>
        {typeof subtitle === "string" && subtitle.length > 0 ? (
          <ThemedText type="caption" themeColor="textSecondary" numberOfLines={1}>
            {subtitle}
          </ThemedText>
        ) : typeof subtitle === "string" ? null : (
          subtitle
        )}
      </View>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: Spacing.three, width: "100%", minHeight: 48 },
  titles: { flex: 1, minWidth: 0 },
});
