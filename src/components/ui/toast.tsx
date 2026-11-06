import { useCallback, useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Platform, StyleSheet, View } from "react-native";
import Animated, { FadeInDown, FadeOutDown } from "react-native-reanimated";

import { ThemedText } from "@/components/themed-text";
import { Icon } from "@/components/ui/icon";
import { Radius, Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

const SHOWN_MS = 2_400;

export function useToast() {
  const [message, setMessage] = useState<{ text: string; id: number } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const show = useCallback((text: string) => {
    if (timer.current) clearTimeout(timer.current);
    setMessage({ text, id: Date.now() });
    if (Platform.OS === "ios") AccessibilityInfo.announceForAccessibilityWithOptions(text, { queue: true });
    timer.current = setTimeout(() => setMessage(null), SHOWN_MS);
  }, []);

  return { message, show };
}

export function Toast({ message, bottom }: { message: { text: string; id: number } | null; bottom: number }) {
  const theme = useTheme();
  return (
    <View pointerEvents="none" style={[styles.layer, { bottom }]}>
      {message ? (
        <Animated.View
          key={message.id}
          entering={FadeInDown.duration(220)}
          exiting={FadeOutDown.duration(200)}
          role="status"
          aria-live="polite"
          testID="toast"
          style={[styles.toast, { backgroundColor: theme.inverse }]}
        >
          <Icon name="check" size={18} color="onInverse" />
          <ThemedText type="smallBold" themeColor="onInverse">
            {message.text}
          </ThemedText>
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  layer: { position: "absolute", left: 0, right: 0, alignItems: "center", paddingHorizontal: Spacing.four },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    minHeight: 44,
    borderRadius: Radius.pill,
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
});
