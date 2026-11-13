import type { ReactNode } from "react";
import { ScrollView, type StyleProp, type ViewStyle } from "react-native";

export function PageScroll({ children, style, testID }: { children: ReactNode; style?: StyleProp<ViewStyle>; testID?: string }) {
  return (
    <ScrollView style={style} contentContainerStyle={{ flexGrow: 1 }} testID={testID}>
      {children}
    </ScrollView>
  );
}
