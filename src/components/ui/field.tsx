import { StyleSheet, TextInput, View, type StyleProp, type TextInputProps, type ViewStyle } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { ControlHeight, Fonts, Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

type Props = TextInputProps & { label?: string; containerStyle?: StyleProp<ViewStyle>; compact?: boolean; inset?: boolean };

export function Field({ label, containerStyle, compact, inset, style, ...input }: Props) {
  const theme = useTheme();
  const box = (
    <TextInput
      placeholderTextColor={theme.textTertiary}
      aria-label={label ?? input.placeholder}
      {...input}
      style={[
        styles.input,
        { minHeight: compact ? 44 : ControlHeight.regular, color: theme.text, backgroundColor: theme.inputFill, borderColor: theme.inputBorder },
        style,
      ]}
    />
  );
  if (!label) return containerStyle ? <View style={containerStyle}>{box}</View> : box;
  return (
    <View style={[styles.labelled, containerStyle]}>
      <ThemedText type="smallBold" themeColor="textSecondary" style={styles.label}>
        {label}
      </ThemedText>
      {box}
    </View>
  );
}

const styles = StyleSheet.create({
  labelled: { gap: Spacing.one + 2 },
  input: {
    paddingHorizontal: 14,
    borderWidth: 1,
    fontFamily: Fonts.body,
    fontSize: 17,
    fontWeight: 400,
    borderRadius: 12,
  },
  label: { fontWeight: 600 },
});
