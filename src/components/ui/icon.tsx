import type { StyleProp, ViewStyle } from "react-native";

import type { ThemeColor } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { iconSymbols } from "@/components/ui/icon-symbols";
import { SymbolView } from "@/components/ui/symbol-view";

export type IconName = keyof typeof iconSymbols;

export function Icon({
  name,
  size = 22,
  color = "text",
  tint,
  style,
}: {
  name: IconName;
  size?: number;
  color?: ThemeColor;
  tint?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  const symbol = iconSymbols[name];
  return (
    <SymbolView
      name={{ ios: symbol.ios, android: symbol.material, web: symbol.material }}
      size={size}
      tintColor={tint ?? theme[color]}
      style={style}
      aria-hidden
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    />
  );
}
