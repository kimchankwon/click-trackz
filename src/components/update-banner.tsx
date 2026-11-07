import { Platform, StyleSheet, View } from "react-native";
import Animated, { FadeInUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ActionButton } from "@/components/action-button";
import { ThemedText } from "@/components/themed-text";
import { MaxContentWidth, Radius, Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { reloadApp } from "@/lib/app-version";
import { usePlayingHere } from "@/lib/playing-here";
import { useUpdateAvailable } from "@/lib/use-update-available";

export function UpdateBanner() {
  const available = useUpdateAvailable();
  const playing = usePlayingHere();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  if (!available || playing) return null;
  return (
    <View pointerEvents="box-none" style={[styles.layer, { top: insets.top + Spacing.two }]}>
      <Animated.View entering={FadeInUp.duration(240)} role="status" testID="update-banner" style={[styles.banner, { backgroundColor: theme.inverse }]}>
        <ThemedText type="smallBold" themeColor="onInverse" style={styles.text}>
          {Platform.OS === "web" ? "A new version is ready" : "An update is ready. Restart to use it."}
        </ThemedText>
        <ActionButton small accent label={Platform.OS === "web" ? "Reload" : "Restart"} testID="update-reload" onPress={reloadApp} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: { position: "absolute", left: 0, right: 0, alignItems: "center", paddingHorizontal: Spacing.three },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.three,
    paddingLeft: Spacing.three,
    paddingRight: Spacing.two,
    paddingVertical: Spacing.two,
    borderRadius: Radius.lg,
    width: "100%",
    maxWidth: MaxContentWidth,
  },
  text: { flex: 1 },
});
