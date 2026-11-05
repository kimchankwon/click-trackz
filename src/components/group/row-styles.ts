import { StyleSheet } from "react-native";

import { Spacing } from "@/constants/theme";

export const rowStyles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: Spacing.three },
  name: { flex: 1 },
  smallButton: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.one, borderRadius: Spacing.three },
});
