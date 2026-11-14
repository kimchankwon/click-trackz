import { Pressable, StyleSheet } from "react-native";

import { Icon } from "@/components/ui/icon";

export function MoveHandle({ by, name, enabled, onMove, testID }: { by: -1 | 1; name: string; enabled: boolean; onMove: (by: -1 | 1) => void; testID: string }) {
  return (
    <Pressable
      role="button"
      aria-label={`Move ${name} ${by < 0 ? "up" : "down"}`}
      aria-disabled={!enabled}
      disabled={!enabled}
      testID={enabled ? testID : undefined}
      onPress={() => onMove(by)}
      hitSlop={{ top: 8, bottom: 8, left: 16, right: 16 }}
      style={({ pressed }) => [styles.handle, !enabled ? styles.disabled : null, pressed ? styles.pressed : null]}
    >
      <Icon name={by < 0 ? "up" : "down"} size={20} color="textTertiary" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  handle: { alignSelf: "center", width: 40, height: 28, alignItems: "center", justifyContent: "center" },
  disabled: { opacity: 0.35 },
  pressed: { opacity: 0.7 },
});
