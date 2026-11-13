import { Image } from "expo-image";
import type { ImageStyle, StyleProp } from "react-native";

export const LOGO_CORAL = "#FF6A4D";

const BAR_HEIGHTS = [62, 38, 38, 38] as const;
const BAR_WIDTH = 10;
const BAR_STEP = 17.5;
const FIRST_BAR_X = 18.75;

const bars = BAR_HEIGHTS.map(
  (height, index) =>
    `<rect x="${FIRST_BAR_X + index * BAR_STEP}" y="${50 - height / 2}" width="${BAR_WIDTH}" height="${height}" rx="${BAR_WIDTH / 2}" fill="${index === 0 ? "#FFFFFF" : "#000000"}"/>`,
).join("");

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="22.5" fill="${LOGO_CORAL}"/>${bars}</svg>`;

const source = { uri: `data:image/svg+xml;base64,${btoa(svg)}` };

export function LogoMark({ size = 80, style }: { size?: number; style?: StyleProp<ImageStyle> }) {
  return <Image source={source} style={[{ width: size, height: size }, style]} contentFit="contain" accessible={false} />;
}
