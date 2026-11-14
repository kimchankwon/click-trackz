import { Pressable, StyleSheet, View } from "react-native";

import { Icon } from "@/components/ui/icon";
import { Radius } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

export function ReorderControl({
  name,
  canMoveUp,
  canMoveDown,
  onMove,
  upTestID,
  downTestID,
  vertical,
}: {
  name: string;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMove: (by: -1 | 1) => void;
  upTestID?: string;
  downTestID?: string;
  vertical?: boolean;
}) {
  const theme = useTheme();
  const segment = (by: -1 | 1, enabled: boolean, testID?: string) => (
    <Pressable
      role="button"
      aria-label={`Move ${name} ${by < 0 ? "up" : "down"}`}
      aria-disabled={!enabled}
      disabled={!enabled}
      testID={enabled ? testID : undefined}
      onPress={() => onMove(by)}
      hitSlop={4}
      style={({ pressed }) => [vertical ? styles.tallSegment : styles.segment, pressed ? styles.pressed : null]}
    >
      <Icon name={by < 0 ? "up" : "down"} size={18} color={enabled ? "text" : "dotInactive"} />
    </Pressable>
  );
  return (
    <View style={[vertical ? styles.column : styles.pill, { backgroundColor: theme.backgroundSelected }]}>
      {segment(-1, canMoveUp, upTestID)}
      <View style={[vertical ? styles.rule : styles.divider, { backgroundColor: theme.inputBorder }]} />
      {segment(1, canMoveDown, downTestID)}
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { flexDirection: "row", alignItems: "center", height: 36, borderRadius: Radius.sm, overflow: "hidden" },
  segment: { width: 40, height: 36, alignItems: "center", justifyContent: "center" },
  divider: { width: 1, height: 20 },
  column: { borderRadius: Radius.sm, overflow: "hidden" },
  tallSegment: { width: 32, height: 44, alignItems: "center", justifyContent: "center" },
  rule: { height: 1, width: 18, alignSelf: "center" },
  pressed: { opacity: 0.6 },
});
