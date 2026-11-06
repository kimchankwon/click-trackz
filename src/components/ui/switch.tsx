import { Pressable, StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

export function Switch({
  label,
  value,
  onChange,
  testID,
  hint,
  bare,
}: {
  bare?: boolean;
  label: string;
  value: boolean;
  onChange: (next: boolean) => void;
  testID?: string;
  hint?: string;
}) {
  const theme = useTheme();
  return (
    <Pressable role="switch" aria-checked={value} aria-label={label} testID={testID} onPress={() => onChange(!value)} style={styles.row}>
      {bare ? null : (
        <View style={styles.text}>
          <ThemedText style={styles.label}>{label}</ThemedText>
          {hint ? (
            <ThemedText type="small" themeColor="textSecondary" style={styles.hint}>
              {hint}
            </ThemedText>
          ) : null}
        </View>
      )}
      <View style={[styles.track, { backgroundColor: value ? theme.accent : theme.backgroundSelected }]}>
        <View style={[styles.thumb, value ? styles.thumbOn : null]} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: Spacing.three, minHeight: 44 },
  text: { flex: 1 },
  hint: { fontWeight: 400 },
  label: { fontSize: 17, lineHeight: 22, fontWeight: 600 },
  track: { width: 51, height: 31, borderRadius: 16, padding: 2, justifyContent: "center" },
  thumb: { width: 27, height: 27, borderRadius: 14, backgroundColor: "#FFFFFF", boxShadow: "0 1px 3px rgba(0, 0, 0, 0.25)" },
  thumbOn: { alignSelf: "flex-end" },
});
