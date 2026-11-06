import { Pressable, StyleSheet, useColorScheme, View } from "react-native";

import { Card } from "@/components/group/card";
import { ThemedText } from "@/components/themed-text";
import { Icon } from "@/components/ui/icon";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { useAccent } from "@/theme/accent-store";
import { accentIds, accentPalettes } from "@/theme/accents";
import { useChooseAccent } from "@/theme/use-accent-profile";

const SWATCH = 38;

export function AccentPicker() {
  const theme = useTheme();
  const mode = useColorScheme() === "dark" ? "dark" : "light";
  const current = useAccent();
  const { choose, signedIn, saveError } = useChooseAccent();
  return (
    <Card title="Colour">
      <View style={styles.swatches} role="radiogroup" aria-label="Colour theme">
        {accentIds.map((id) => {
          const tokens = accentPalettes[id][mode];
          const selected = id === current;
          return (
            <Pressable
              key={id}
              role="radio"
              aria-checked={selected}
              aria-label={accentPalettes[id].label}
              testID={`accent-${id}`}
              hitSlop={4}
              onPress={() => choose(id)}
              style={[styles.swatch, { backgroundColor: tokens.accent, borderColor: selected ? theme.text : "transparent" }]}
            >
              {selected ? <Icon name="check" size={22} tint={tokens.onAccent} /> : null}
            </Pressable>
          );
        })}
      </View>
      <ThemedText type="caption" themeColor="textSecondary" testID="accent-caption">
        {signedIn ? "Saved to your profile, so it follows you to your other devices." : "Saved on this device. Sign in with Google to keep it on every device."}
      </ThemedText>
      {saveError !== null ? (
        <ThemedText type="caption" themeColor="danger" testID="accent-error">
          {saveError}
        </ThemedText>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  swatches: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.two },
  swatch: { width: SWATCH, height: SWATCH, borderRadius: SWATCH / 2, borderWidth: 3, alignItems: "center", justifyContent: "center" },
});
