import { Pressable, StyleSheet } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { Icon, type IconName } from "@/components/ui/icon";
import { ControlHeight, Fonts, Radius, Spacing, type ThemeColor } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

export type ButtonVariant = "primary" | "secondary" | "inverse" | "ghost" | "danger" | "outline" | "stop";

type Props = {
  label: string;
  onPress: () => void;
  testID?: string;
  accent?: boolean;
  variant?: ButtonVariant;
  small?: boolean;
  large?: boolean;
  full?: boolean;
  icon?: IconName;
  accessibleName?: string;
  disabled?: boolean;
};

const fills: Record<ButtonVariant, { background: ThemeColor | null; text: ThemeColor; border?: ThemeColor }> = {
  primary: { background: "accent", text: "onAccent" },
  secondary: { background: "backgroundSelected", text: "text" },
  inverse: { background: "inverse", text: "onInverse" },
  ghost: { background: null, text: "text" },
  danger: { background: null, text: "danger", border: "danger" },
  outline: { background: null, text: "text", border: "backgroundSelected" },
  stop: { background: "backgroundElement", text: "accent", border: "accent" },
};

export function ActionButton({ label, onPress, testID, accent, variant, small, large, full, icon, accessibleName, disabled }: Props) {
  const theme = useTheme();
  const look = fills[variant ?? (accent ? "primary" : "secondary")];
  const textColor = disabled ? "textTertiary" : look.text;
  const background = disabled && look.background ? theme.backgroundSelected : look.background ? theme[look.background] : "transparent";
  const height = large ? ControlHeight.large : small ? ControlHeight.small : ControlHeight.regular;
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
        look.border ? { borderWidth: 2, borderColor: disabled ? theme.backgroundSelected : theme[look.border] } : null,
        full ? styles.full : null,
        pressed && !disabled ? styles.pressed : null,
      ]}
    >
      {icon ? <Icon name={icon} size={large ? 24 : small ? 18 : 20} color={textColor} /> : null}
      <ThemedText
        type={small ? "smallBold" : "default"}
        themeColor={textColor}
        numberOfLines={1}
        style={[styles.label, large ? styles.largeLabel : null]}
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
  label: { fontWeight: 700, flexShrink: 1 },
  largeLabel: { fontFamily: Fonts.display, fontSize: 18, lineHeight: 24 },
});
