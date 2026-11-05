import { StyleSheet, TextInput, View, type StyleProp, type TextInputProps, type ViewStyle } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { ControlHeight, Fonts, Radius, Spacing } from "@/constants/theme";
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
        { minHeight: compact ? 44 : ControlHeight.regular, color: theme.text, backgroundColor: inset ? theme.background : theme.backgroundElement },
        style,
      ]}
    />
  );
  if (!label) return containerStyle ? <View style={containerStyle}>{box}</View> : box;
  return (
    <View style={[styles.labelled, containerStyle]}>
      <ThemedText type="label" themeColor="textSecondary">
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
    borderRadius: Radius.md,
    fontFamily: Fonts.body,
    fontSize: 16,
    fontWeight: 500,
  },
});
