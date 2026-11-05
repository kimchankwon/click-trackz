import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

export function Card({ title, children }: { title: string; children: ReactNode }) {
  const theme = useTheme();
  return (
    <View style={[styles.card, { borderColor: theme.backgroundSelected }]}>
      <ThemedText type="smallBold" themeColor="textSecondary">
        {title}
      </ThemedText>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { width: "100%", gap: Spacing.three, padding: Spacing.three, borderWidth: 1, borderRadius: Spacing.four },
});
