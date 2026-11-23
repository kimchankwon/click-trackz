import { isLoaded, loadAsync } from "expo-font";
import type { SymbolViewProps } from "expo-symbols";
import { useEffect, useState } from "react";
import { Text, View } from "react-native";

import glyphs from "../../../assets/fonts/material-symbols-icons.json";

const FONT_FAMILY = "MaterialSymbolsIcons";
const fontSource = require("../../../assets/fonts/material-symbols-icons.ttf");

let loading: Promise<void> | null = null;
const loadFont = () => (loading ??= loadAsync({ [FONT_FAMILY]: fontSource }));

const glyphFor = (name: string | undefined) => {
  const code = name === undefined ? undefined : (glyphs as Record<string, number>)[name];
  return code === undefined ? null : String.fromCharCode(code);
};

export function SymbolView({ name, size = 24, tintColor, style, fallback, ...viewProps }: SymbolViewProps) {
  const [loaded, setLoaded] = useState(() => isLoaded(FONT_FAMILY));
  useEffect(() => {
    if (loaded) return;
    let live = true;
    loadFont().then(
      () => {
        if (live) setLoaded(true);
      },
      () => undefined,
    );
    return () => {
      live = false;
    };
  }, [loaded]);
  const glyph = typeof name === "object" ? glyphFor(name.web) : null;
  if (glyph === null) return <>{fallback}</>;
  const box = [{ width: size, height: size }, style];
  if (!loaded) return <View collapsable={false} {...viewProps} style={box} />;
  return (
    <View collapsable={false} {...viewProps} style={box}>
      <Text aria-hidden style={{ fontFamily: FONT_FAMILY, color: tintColor, fontSize: size, lineHeight: size }}>
        {glyph}
      </Text>
    </View>
  );
}
