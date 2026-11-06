import { StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { Fonts } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { initialsOf } from "@/lib/initials";

const palette = [
  { light: ["#DDEBFF", "#1F5FBF"], dark: ["#7FB0FF38", "#7FB0FF"] },
  { light: ["#DFF5E3", "#1E7A35"], dark: ["#6FD68A38", "#6FD68A"] },
  { light: ["#FFF0D1", "#8A5A00"], dark: ["#F5C45138", "#F5C451"] },
  { light: ["#EDE3FF", "#5B3DB5"], dark: ["#B79CFF38", "#B79CFF"] },
  { light: ["#E0F4F7", "#11717F"], dark: ["#6CCFDC38", "#6CCFDC"] },
] as const;

export function avatarColorsFor(name: string, scheme: "light" | "dark", position?: number) {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.codePointAt(0)!) >>> 0;
  const [background, text] = palette[(position ?? hash) % palette.length][scheme];
  return { background, text };
}

export function Avatar({ name, size = 40, position }: { name: string; size?: number; position?: number }) {
  const scheme = useColorScheme() === "dark" ? "dark" : "light";
  const colors = avatarColorsFor(name, scheme, position);
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: colors.background }]}>
      <ThemedText
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.5}
        style={[styles.initials, { color: colors.text, fontSize: Math.round(size * 0.42), lineHeight: Math.round(size * 0.55) }]}
      >
        {initialsOf(name)}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: { alignItems: "center", justifyContent: "center", paddingHorizontal: 3 },
  initials: { fontFamily: Fonts.display, fontWeight: 700, letterSpacing: -0.3 },
});
