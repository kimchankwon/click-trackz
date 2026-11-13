import { Image } from "expo-image";

import type { ThemeColor } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

const svgFor = (color: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2.4" stroke-linecap="round">` +
  '<path d="M4 10v4M8 7v10M12 4v16M16 7v10M20 10v4"/>' +
  "</svg>";

export function LogoMark({ size = 40, color = "onAccent" }: { size?: number; color?: ThemeColor }) {
  const theme = useTheme();
  const source = { uri: `data:image/svg+xml;utf8,${encodeURIComponent(svgFor(theme[color]))}` };
  return <Image source={source} style={{ width: size, height: size }} contentFit="contain" accessible={false} />;
}
