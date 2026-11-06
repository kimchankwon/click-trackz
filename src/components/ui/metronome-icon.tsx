import { Image } from "expo-image";

import type { ThemeColor } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

const svgFor = (color: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">` +
  '<path d="M9.2 3h5.6l4.2 17H5L9.2 3z"/>' +
  '<path d="M6.3 15h11.4"/>' +
  '<path d="M12 15l5-9"/>' +
  '<circle cx="15.6" cy="8.4" r="1.2"/>' +
  "</svg>";

export function MetronomeIcon({ size = 22, color = "textSecondary" }: { size?: number; color?: ThemeColor }) {
  const theme = useTheme();
  const source = { uri: `data:image/svg+xml;utf8,${encodeURIComponent(svgFor(theme[color]))}` };
  return <Image source={source} style={{ width: size, height: size }} contentFit="contain" accessible={false} />;
}
