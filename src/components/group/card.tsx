import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { Radius, Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

export function Card({
  title,
  heading,
  action,
  children,
  plain,
}: {
  title: string;
  heading?: string;
  action?: ReactNode;
  children: ReactNode;
  plain?: boolean;
}) {
  const theme = useTheme();
  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <View style={styles.titles}>
          <ThemedText type="label" themeColor="textSecondary" role={heading ? undefined : "heading"}>
            {title}
          </ThemedText>
          {heading ? (
            <ThemedText type="heading" role="heading" numberOfLines={1} style={styles.heading}>
              {heading}
            </ThemedText>
          ) : null}
        </View>
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
  header: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", minHeight: 32, paddingHorizontal: Spacing.one, gap: Spacing.two },
  titles: { flex: 1, minWidth: 0, gap: 2 },
  heading: { fontSize: 22, lineHeight: 28 },
  body: { gap: Spacing.three, borderRadius: Radius.lg },
  divider: { height: StyleSheet.hairlineWidth, alignSelf: "stretch" },
});
