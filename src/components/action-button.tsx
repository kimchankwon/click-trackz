import type { ReactNode } from "react";
import { Pressable, StyleSheet } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { Icon, type IconName } from "@/components/ui/icon";
import { ControlHeight, Fonts, Radius, Spacing, type ThemeColor } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

export type ButtonVariant = "primary" | "secondary" | "inverse" | "ghost" | "link" | "danger" | "outline" | "stop" | "pill";

type Props = {
  label: string;
  onPress: () => void;
  testID?: string;
  accent?: boolean;
  variant?: ButtonVariant;
  small?: boolean;
  large?: boolean;
  huge?: boolean;
  full?: boolean;
  icon?: IconName;
  leading?: ReactNode;
  accessibleName?: string;
  disabled?: boolean;
};

const fills: Record<ButtonVariant, { background: ThemeColor | null; text: ThemeColor; border?: ThemeColor }> = {
  primary: { background: "accent", text: "onAccent" },
  secondary: { background: "backgroundElement", text: "accent", border: "border" },
  inverse: { background: "inverse", text: "onInverse" },
  ghost: { background: null, text: "textSecondary" },
  link: { background: null, text: "accent" },
  danger: { background: null, text: "danger" },
  outline: { background: "inputFill", text: "text", border: "inputBorder" },
  stop: { background: "stopFill", text: "onStop" },
  pill: { background: "backgroundSelected", text: "text" },
};

export function ActionButton({ label, onPress, testID, accent, variant, small, large, huge, full, icon, leading, accessibleName, disabled }: Props) {
  const theme = useTheme();
  const look = fills[variant ?? (accent ? "primary" : "secondary")];
  const textColor = look.text;
  const background = look.background ? theme[look.background] : "transparent";
  const height = huge ? 64 : large ? ControlHeight.large : small ? ControlHeight.small : ControlHeight.regular;
  return (
    <Pressable
      role="button"
      testID={testID}
      aria-label={accessibleName}
      aria-disabled={disabled}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { minHeight: height, backgroundColor: background, paddingHorizontal: small ? Spacing.three : Spacing.four },
        look.border ? { borderWidth: 1, borderColor: theme[look.border] } : null,
        disabled ? styles.disabled : null,
        full ? styles.full : null,
        pressed && !disabled ? styles.pressed : null,
      ]}
    >
      {leading ?? (icon ? <Icon name={icon} size={large || huge ? 22 : small ? 18 : 20} color={textColor} /> : null)}
      <ThemedText
        type={small ? "smallBold" : "default"}
        themeColor={textColor}
        numberOfLines={1}
        style={[small ? styles.smallLabel : styles.label, large || huge ? styles.largeLabel : null, huge ? styles.hugeLabel : null]}
      >
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.two,
    borderRadius: Radius.md,
  },
  full: { alignSelf: "stretch", flexGrow: 1 },
  pressed: { opacity: 0.75 },
  disabled: { opacity: 0.4 },
  label: { fontWeight: 600, flexShrink: 1 },
  smallLabel: { fontWeight: 600, fontSize: 15, flexShrink: 1 },
  largeLabel: { fontFamily: Fonts.display, fontWeight: 700, fontSize: 18, lineHeight: 24 },
  hugeLabel: { fontSize: 20, lineHeight: 26 },
});
