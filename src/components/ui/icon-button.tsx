import { Pressable, StyleSheet } from "react-native";

import { Icon, type IconName } from "@/components/ui/icon";
import { Radius, type ThemeColor } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

export function IconButton({
  icon,
  label,
  onPress,
  testID,
  color = "text",
  filled,
  disabled,
  size = 44,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  testID?: string;
  color?: ThemeColor;
  filled?: boolean;
  disabled?: boolean;
  size?: number;
}) {
  const theme = useTheme();
  return (
    <Pressable
      role="button"
      aria-label={label}
      testID={testID}
      disabled={disabled}
      onPress={onPress}
      hitSlop={4}
      style={({ pressed }) => [
        styles.button,
        { width: size, height: size, backgroundColor: filled ? theme.backgroundElement : "transparent" },
        disabled ? styles.disabled : null,
        pressed ? styles.pressed : null,
      ]}
    >
      <Icon name={icon} size={Math.round(size * 0.55)} color={color} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { alignItems: "center", justifyContent: "center", borderRadius: Radius.sm },
  disabled: { opacity: 0.35 },
  pressed: { opacity: 0.6 },
});
