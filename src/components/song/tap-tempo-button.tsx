import { useRef, useState } from "react";
import { Pressable, StyleSheet } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { Icon } from "@/components/ui/icon";
import { useTheme } from "@/hooks/use-theme";
import { addTap, tappedBpm } from "@/lib/tap-tempo";

export function TapTempoButton({ onTempo, testID }: { onTempo: (bpm: number) => void; testID?: string }) {
  const theme = useTheme();
  const taps = useRef<number[]>([]);
  const [shown, setShown] = useState<number | null>(null);
  const tap = () => {
    taps.current = addTap(taps.current, performance.now());
    const bpm = tappedBpm(taps.current);
    setShown(bpm);
    if (bpm !== null) onTempo(bpm);
  };
  return (
    <Pressable
      role="button"
      aria-label={shown === null ? "Tap tempo" : `Tap tempo, ${shown} BPM`}
      testID={testID}
      onPressIn={tap}
      onPress={() => undefined}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: pressed ? theme.accentTint : theme.inputFill, borderColor: pressed ? theme.accent : theme.inputBorder },
      ]}
    >
      <Icon name="touch" size={20} color="accent" />
      <ThemedText style={styles.label}>{shown === null ? "Tap tempo" : `Tap · ${shown} BPM`}</ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, minHeight: 48, borderRadius: 12, borderWidth: 1, paddingHorizontal: 16 },
  label: { fontSize: 16, fontWeight: 600, fontVariant: ["tabular-nums"] },
});
