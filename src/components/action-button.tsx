import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { Icon, type IconName } from "@/components/ui/icon";
import { ControlHeight, Fonts, Radius, Spacing, type ThemeColor } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "inverse"
  | "ghost"
  | "link"
  | "selected"
  | "quiet"
  | "subtle"
  | "danger"
  | "outline"
  | "stop"
  | "pill";

type Props = {
  label: string;
  onPress: () => void;
  testID?: string;
  accent?: boolean;
  variant?: ButtonVariant;
  small?: boolean;
  tiny?: boolean;
  medium?: boolean;
  rounded?: boolean;
  large?: boolean;
  huge?: boolean;
  full?: boolean;
  icon?: IconName;
  leading?: ReactNode;
  accessibleName?: string;
  disabled?: boolean;
  pending?: boolean;
};

const fills: Record<ButtonVariant, { background: ThemeColor | null; text: ThemeColor; border?: ThemeColor }> = {
  primary: { background: "accent", text: "onAccent" },
  secondary: { background: "backgroundSelected", text: "text" },
  inverse: { background: "inverse", text: "onInverse" },
  ghost: { background: null, text: "text" },
  link: { background: null, text: "text" },
  selected: { background: "accentTint", text: "accent", border: "accent" },
  quiet: { background: null, text: "text", border: "inputBorder" },
  subtle: { background: null, text: "textSecondary" },
  danger: { background: null, text: "danger" },
  outline: { background: "inputFill", text: "text", border: "inputBorder" },
  stop: { background: "stopFill", text: "onStop", border: "stopBorder" },
  pill: { background: "backgroundSelected", text: "text" },
};

export function ActionButton({ label, onPress, testID, accent, variant, small, tiny, medium, rounded, large, huge, full, icon, leading, accessibleName, disabled, pending }: Props) {
  const theme = useTheme();
  const look = fills[variant ?? (accent ? "primary" : "secondary")];
  const textColor = look.text;
  const background = look.background ? theme[look.background] : "transparent";
  const blocked = disabled || pending;
  const height = huge ? 64 : large ? ControlHeight.large : medium ? 44 : tiny ? 32 : small ? ControlHeight.small : ControlHeight.regular;
  return (
    <Pressable
      role="button"
      testID={testID}
      aria-label={accessibleName}
      aria-disabled={blocked}
      aria-busy={pending}
      disabled={blocked}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { minHeight: height, backgroundColor: background, paddingHorizontal: tiny ? 12 : small ? Spacing.three : Spacing.four },
        look.border ? { borderWidth: 1, borderColor: theme[look.border] } : null,
        disabled ? styles.disabled : null,
        pending ? styles.pending : null,
        full ? styles.full : null,
        rounded ? { borderRadius: height / 2 } : null,
        pressed && !blocked ? styles.pressed : null,
      ]}
    >
      {pending ? <ActivityIndicator size="small" color={theme[textColor]} /> : leading ?? (icon ? <Icon name={icon} size={large || huge ? 22 : small ? 18 : 20} color={textColor} /> : null)}
      <ThemedText
        type={small ? "smallBold" : "default"}
        themeColor={textColor}
        numberOfLines={1}
        style={[
          styles.label,
          small || medium ? styles.smallLabel : null,
          tiny ? styles.tinyLabel : null,
          variant === "outline" || variant === "ghost" || variant === "link" || variant === "pill" || variant === "secondary" || variant === "quiet" || variant === "subtle"
            ? styles.quietLabel
            : null,
          variant === "danger" ? styles.dangerLabel : null,
        ]}
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
    borderRadius: Radius.md + 2,
  },
  full: { alignSelf: "stretch", flexGrow: 1, flexShrink: 1, minWidth: 0 },
  pressed: { opacity: 0.75 },
  disabled: { opacity: 0.4 },
  pending: { opacity: 0.6 },
  label: { fontFamily: Fonts.body, fontWeight: 600, fontSize: 17, lineHeight: 22, flexShrink: 1 },
  smallLabel: { fontSize: 15, lineHeight: 20 },
  tinyLabel: { fontSize: 13, lineHeight: 18 },
  quietLabel: { fontFamily: Fonts.body, fontWeight: 600, fontSize: 15 },
  dangerLabel: { fontFamily: Fonts.body, fontWeight: 600, fontSize: 17 },
});
