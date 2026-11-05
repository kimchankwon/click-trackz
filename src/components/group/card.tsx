import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { Radius, Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

export function Card({
  title,
  action,
  children,
  plain,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  plain?: boolean;
}) {
  const theme = useTheme();
  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <ThemedText type="label" themeColor="textSecondary" role="heading">
          {title}
        </ThemedText>
        {action}
      </View>
      <View style={[styles.body, plain ? null : { backgroundColor: theme.backgroundElement, padding: Spacing.three }]}>{children}</View>
    </View>
  );
}

export function Divider() {
  const theme = useTheme();
  return <View style={[styles.divider, { backgroundColor: theme.border }]} />;
}

const styles = StyleSheet.create({
  section: { width: "100%", gap: Spacing.two },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 32, paddingHorizontal: Spacing.one },
  body: { gap: Spacing.three, borderRadius: Radius.lg },
  divider: { height: StyleSheet.hairlineWidth, alignSelf: "stretch" },
});
