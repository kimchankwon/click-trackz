import { Pressable, StyleSheet } from "react-native";

import { Icon } from "@/components/ui/icon";
import { useTheme } from "@/hooks/use-theme";

export function MoveHandle({ by, name, enabled, onMove, testID }: { by: -1 | 1; name: string; enabled: boolean; onMove: (by: -1 | 1) => void; testID: string }) {
  const theme = useTheme();
  return (
    <Pressable
      role="button"
      aria-label={`Move ${name} ${by < 0 ? "up" : "down"}`}
      aria-disabled={!enabled}
      disabled={!enabled}
      testID={enabled ? testID : undefined}
      onPress={() => onMove(by)}
      hitSlop={{ top: 6, bottom: 6, left: 24, right: 24 }}
      style={({ pressed }) => [styles.handle, { backgroundColor: theme.backgroundSelected }, !enabled ? styles.disabled : null, pressed ? styles.pressed : null]}
    >
      <Icon name={by < 0 ? "up" : "down"} size={16} color={enabled ? "text" : "textTertiary"} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  handle: { alignSelf: "center", width: 64, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  disabled: { opacity: 0.35 },
  pressed: { opacity: 0.7 },
});
