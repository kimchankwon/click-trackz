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
  titleEnd,
  subtitleEnd,
}: {
  title: string;
  subtitle?: ReactNode;
  onBack?: () => void;
  backLabel?: string;
  backTestID?: string;
  titleEnd?: ReactNode;
  subtitleEnd?: ReactNode;
}) {
  const shownSubtitle =
    typeof subtitle !== "string" ? (
      subtitle
    ) : subtitle.length > 0 ? (
      <ThemedText type="caption" themeColor="textSecondary" numberOfLines={1}>
        {subtitle}
      </ThemedText>
    ) : null;
  return (
    <View style={styles.header}>
      {onBack ? <IconButton icon="back" label={backLabel} testID={backTestID} onPress={onBack} filled round /> : null}
      <View style={styles.titles}>
        <View style={styles.line}>
          <ThemedText type="heading" numberOfLines={1} role="heading" style={styles.grow}>
            {title}
          </ThemedText>
          {titleEnd}
        </View>
        {shownSubtitle || subtitleEnd ? (
          <View style={styles.line}>
            <View style={styles.grow}>{shownSubtitle}</View>
            {subtitleEnd}
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: Spacing.three, width: "100%", minHeight: 48 },
  titles: { flex: 1, minWidth: 0 },
  line: { flexDirection: "row", alignItems: "center", gap: Spacing.two },
  grow: { flex: 1, minWidth: 0 },
});
