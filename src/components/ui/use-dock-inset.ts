import { Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export function useDockInset(minimum = 0) {
  const insets = useSafeAreaInsets();
  return Platform.OS === "web" ? minimum : Math.max(insets.bottom, minimum);
}
