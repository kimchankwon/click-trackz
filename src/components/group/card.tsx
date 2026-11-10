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
  tight,
  banner,
}: {
  tight?: boolean;
  banner?: ReactNode;
  title?: string;
  heading?: string;
  action?: ReactNode;
  children: ReactNode;
  plain?: boolean;
}) {
  const theme = useTheme();
  return (
    <View style={styles.section}>
      {title !== undefined || heading || action ? (
        <View style={styles.header}>
          <View style={styles.titles}>
            {title !== undefined ? (
              <ThemedText type="label" themeColor="textSecondary" role={heading ? undefined : "heading"}>
                {title}
              </ThemedText>
            ) : null}
            {heading ? (
              <ThemedText type="heading" role="heading" numberOfLines={2} style={styles.heading}>
                {heading}
              </ThemedText>
            ) : null}
          </View>
          {action && !heading ? action : null}
        </View>
      ) : null}
      {action && heading ? <View style={styles.actionRow}>{action}</View> : null}
      {banner}
      <View
        style={[
          styles.body,
          plain ? null : { backgroundColor: theme.backgroundElement, padding: Spacing.three },
          tight ? { paddingVertical: Spacing.one } : null,
        ]}
      >
        {children}
      </View>
    </View>
  );
}

export function Divider({ inset = 0 }: { inset?: number }) {
  const theme = useTheme();
  return <View style={[styles.divider, { backgroundColor: theme.border, marginLeft: inset }]} />;
}

const styles = StyleSheet.create({
  section: { width: "100%", gap: Spacing.two },
  header: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", minHeight: 24, paddingHorizontal: Spacing.one, gap: Spacing.two },
  actionRow: { flexDirection: "row", gap: Spacing.two, paddingHorizontal: Spacing.one },
  titles: { flex: 1, minWidth: 0, gap: 2 },
  heading: { fontSize: 28, lineHeight: 34, fontWeight: 800 },
  body: { gap: Spacing.three, borderRadius: Radius.lg },
  divider: { height: StyleSheet.hairlineWidth, alignSelf: "stretch" },
});
