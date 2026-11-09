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
  metaLabel,
  songKey,
  showKey = true,
  needsSections,
  selected,
  selectable,
  opens,
  label,
  onSelect,
  trailing,
  testID,
  warningAsDot,
  divider,
}: {
  index?: number;
  title: string;
  meta?: string | readonly string[] | null;
  metaLabel?: string | null;
  songKey?: string | null;
  showKey?: boolean;
  needsSections?: boolean;
  selected: boolean;
  selectable: boolean;
  opens?: boolean;
  label?: string;
  onSelect: () => void;
  trailing?: ReactNode;
  testID?: string;
  warningAsDot?: boolean;
  divider?: boolean;
}) {
  const theme = useTheme();
  const metaParts = typeof meta === "string" ? [meta] : (meta ?? []);
  const shownParts = [needsSections && !warningAsDot ? "No Sections yet" : null, ...metaParts].filter((part): part is string => Boolean(part));
  const spokenKey = showKey ? (songKey ? `Key of ${songKey}` : "No Key") : null;
  const spokenLabel = label ? [label, needsSections ? "No Sections yet" : null, metaLabel ?? metaParts.join(", "), spokenKey].filter(Boolean).join(", ") : undefined;
  return (
    <View style={[styles.row, selected ? { backgroundColor: theme.accentTint } : null]}>
      {divider && !selected ? <View style={[styles.divider, { backgroundColor: theme.border, left: index !== undefined ? 54 : Spacing.two }]} /> : null}
      <Pressable
        role={selectable ? (opens ? "button" : "radio") : undefined}
        aria-checked={selectable && !opens ? selected : undefined}
        aria-label={selectable ? spokenLabel : undefined}
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
          {shownParts.length > 0 || needsSections ? (
            <View style={styles.metaRow}>
              {needsSections ? (
                <View role="img" aria-label="No Sections yet" style={[styles.dot, { backgroundColor: theme.warning }]} />
              ) : null}
              {shownParts.length > 0 ? (
                <View style={styles.metaParts}>
                  {shownParts.map((part, index) => (
                    <ThemedText key={index} type="small" themeColor="textSecondary" numberOfLines={1} style={index === shownParts.length - 1 ? styles.meta : null}>
                      {part}
                    </ThemedText>
                  ))}
                </View>
              ) : null}
            </View>
          ) : null}
        </View>
        {!showKey ? null : songKey ? (
          <View style={[styles.keyPill, { backgroundColor: selected ? theme.background : theme.backgroundSelected }]} aria-label={`Key of ${songKey}`}>
            <ThemedText type="smallBold" style={styles.keyText}>
              {songKey}
            </ThemedText>
          </View>
        ) : (
          <View style={styles.keyPill} aria-label="No Key" />
        )}
        {selected && selectable && !opens ? <Icon name="check" size={20} color="accent" /> : null}
      </Pressable>
      {trailing}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", borderRadius: Radius.md, paddingRight: Spacing.one },
  divider: { position: "absolute", top: -1, right: Spacing.two, height: StyleSheet.hairlineWidth },
  main: { flex: 1, flexDirection: "row", alignItems: "center", gap: Spacing.three, minHeight: 56, paddingHorizontal: Spacing.two },
  index: { width: 24, textAlign: "right", fontSize: 13, fontVariant: ["tabular-nums"] },
  text: { flex: 1, minWidth: 0 },
  title: { fontWeight: 600, fontSize: 17 },
  keyText: { fontSize: 15, lineHeight: 20, fontVariant: ["tabular-nums"] },
  metaRow: { flexDirection: "row", alignItems: "center", gap: Spacing.one + 2 },
  meta: { flexShrink: 1 },
  metaParts: { flexDirection: "row", alignItems: "center", gap: Spacing.three, flexShrink: 1, minWidth: 0 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  keyPill: { width: 44, height: 32, borderRadius: Radius.sm, alignItems: "center", justifyContent: "center" },
});
