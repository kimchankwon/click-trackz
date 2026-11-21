import { Link } from "expo-router";
import { StyleSheet } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { Spacing } from "@/constants/theme";

export function AboutLink() {
  return (
    <Link href="/about" testID="about-link" style={styles.aboutLink}>
      <ThemedText type="smallBold" themeColor="accent">
        About Click Trackz
      </ThemedText>
    </Link>
  );
}

const styles = StyleSheet.create({
  aboutLink: { alignSelf: "center", paddingVertical: Spacing.two },
});
