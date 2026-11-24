import type { ReactNode } from "react";
import { ScrollView, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";

export const HEADER_EDGES: Edge[] = ["left", "right"];

export function PageScroll({ children, style, testID }: { children: ReactNode; style?: StyleProp<ViewStyle>; testID?: string }) {
  return (
    <SafeAreaView edges={["top"]} style={[styles.frame, style]}>
      <ScrollView contentContainerStyle={styles.content} testID={testID}>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  frame: { flex: 1 },
  content: { flexGrow: 1 },
});
