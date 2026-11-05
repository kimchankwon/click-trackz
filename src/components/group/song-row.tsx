import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { Icon } from "@/components/ui/icon";
import { Radius, Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

export function SongRow({
  index,
  title,
  meta,
  songKey,
  needsSections,
  selected,
  selectable,
  onSelect,
  trailing,
  testID,
}: {
  index?: number;
  title: string;
  meta?: string | null;
  songKey?: string | null;
  needsSections?: boolean;
  selected: boolean;
  selectable: boolean;
  onSelect: () => void;
  trailing?: ReactNode;
  testID?: string;
}) {
  const theme = useTheme();
  return (
    <View style={[styles.row, selected ? { backgroundColor: theme.accentTint } : null]}>
      <Pressable
        role={selectable ? "radio" : undefined}
        aria-checked={selectable ? selected : undefined}
        disabled={!selectable}
        testID={testID}
        onPress={onSelect}
        style={styles.main}
      >
        {index !== undefined ? (
          <ThemedText type="smallBold" themeColor={selected ? "accent" : "textTertiary"} style={styles.index}>
            {index}
          </ThemedText>
        ) : null}
        <View style={styles.text}>
          <ThemedText type="default" themeColor={selected ? "accent" : "text"} style={styles.title} numberOfLines={1}>
            {title}
          </ThemedText>
          {meta || needsSections ? (
            <View style={styles.metaRow}>
              {needsSections ? <View style={[styles.dot, { backgroundColor: theme.warning }]} /> : null}
              <ThemedText type="caption" themeColor="textSecondary" numberOfLines={1} style={styles.meta}>
                {[needsSections ? "No Sections yet" : null, meta].filter(Boolean).join(" · ")}
              </ThemedText>
            </View>
          ) : null}
        </View>
        {songKey ? (
          <View style={[styles.keyPill, { backgroundColor: selected ? theme.background : theme.backgroundSelected }]}>
            <ThemedText type="smallBold" aria-label={`Key of ${songKey}`}>
              {songKey}
            </ThemedText>
          </View>
        ) : null}
        {selected && selectable ? <Icon name="check" size={20} color="accent" /> : null}
      </Pressable>
      {trailing}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", borderRadius: Radius.md, paddingRight: Spacing.one },
  main: { flex: 1, flexDirection: "row", alignItems: "center", gap: Spacing.three, minHeight: 56, paddingHorizontal: Spacing.two },
  index: { width: 22, textAlign: "right", fontVariant: ["tabular-nums"] },
  text: { flex: 1, minWidth: 0 },
  title: { fontWeight: 700 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: Spacing.one + 2 },
  meta: { flexShrink: 1 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  keyPill: { minWidth: 32, height: 28, paddingHorizontal: Spacing.two, borderRadius: Radius.sm, alignItems: "center", justifyContent: "center" },
});
