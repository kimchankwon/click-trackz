import { useState, type ReactNode } from "react";
import { Pressable, StyleSheet, TextInput, View, type StyleProp, type ViewStyle } from "react-native";

import { Icon } from "@/components/ui/icon";
import { Fonts } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { digitsIn, settledNumber, steppedLetter, steppedNumber, typedLetter, typedNumber, type NumberRange } from "@/lib/stepper";

type Shared = { label: string; testID: string; style?: StyleProp<ViewStyle> };

function StepButton({ label, icon, enabled, onPress, testID }: { label: string; icon: "add" | "minus"; enabled: boolean; onPress: () => void; testID: string }) {
  return (
    <Pressable
      role="button"
      aria-label={label}
      aria-disabled={!enabled}
      disabled={!enabled}
      testID={testID}
      onPress={onPress}
      hitSlop={{ left: 4, right: 4 }}
      style={({ pressed }) => [styles.step, pressed ? styles.pressed : null]}
    >
      <Icon name={icon} size={16} color={enabled ? "accent" : "dotInactive"} />
    </Pressable>
  );
}

function Stepper({ label, testID, style, canUp, canDown, onUp, onDown, children }: Shared & { canUp: boolean; canDown: boolean; onUp: () => void; onDown: () => void; children: ReactNode }) {
  const theme = useTheme();
  return (
    <View style={[styles.box, { backgroundColor: theme.inputFill, borderColor: theme.inputBorder }, style]}>
      <StepButton label={`Increase ${label}`} icon="add" enabled={canUp} onPress={onUp} testID={`${testID}-up`} />
      <View style={[styles.rule, { backgroundColor: theme.inputBorder }]} />
      {children}
      <View style={[styles.rule, { backgroundColor: theme.inputBorder }]} />
      <StepButton label={`Decrease ${label}`} icon="minus" enabled={canDown} onPress={onDown} testID={`${testID}-down`} />
    </View>
  );
}

export function NumberStepper({
  label,
  testID,
  style,
  value,
  range,
  placeholder,
  stepFrom,
  muted,
  onChange,
}: Shared & { value: number | undefined; range: NumberRange; placeholder?: string; stepFrom?: number; muted?: boolean; onChange: (next: number | undefined) => void }) {
  const theme = useTheme();
  const [draft, setDraft] = useState<string | null>(null);
  const from = value ?? stepFrom;
  const step = (by: 1 | -1) => {
    setDraft(null);
    onChange(steppedNumber(value, by, range, from));
  };
  return (
    <Stepper
      label={label}
      testID={testID}
      style={style}
      canUp={from === undefined || from < range.max}
      canDown={from !== undefined && (from > range.min || (range.optional === true && value !== undefined))}
      onUp={() => step(1)}
      onDown={() => step(-1)}
    >
      <TextInput
        aria-label={label}
        testID={testID}
        value={draft ?? (value === undefined ? "" : String(value))}
        placeholder={placeholder}
        placeholderTextColor={muted ? theme.textSecondary : theme.textTertiary}
        inputMode="numeric"
        keyboardType="number-pad"
        selectTextOnFocus
        maxLength={String(range.max).length}
        onFocus={() => setDraft(value === undefined ? "" : String(value))}
        onChangeText={(text) => {
          const digits = digitsIn(text, range);
          setDraft(digits);
          const typed = typedNumber(digits, range);
          if (typed !== null && typed !== value) onChange(typed);
        }}
        onBlur={() => {
          if (draft !== null) {
            const settled = settledNumber(draft, range, value);
            if (settled !== value) onChange(settled);
          }
          setDraft(null);
        }}
        style={[styles.input, { color: theme.text }]}
      />
    </Stepper>
  );
}

export function LetterStepper({ label, testID, style, value, onChange }: Shared & { value: string | undefined; onChange: (next: string | undefined) => void }) {
  const theme = useTheme();
  return (
    <Stepper
      label={label}
      testID={testID}
      style={style}
      canUp={value !== "Z"}
      canDown={value !== undefined}
      onUp={() => onChange(steppedLetter(value, 1))}
      onDown={() => onChange(steppedLetter(value, -1))}
    >
      <TextInput
        aria-label={label}
        testID={testID}
        value={value ?? ""}
        placeholder="–"
        placeholderTextColor={theme.textTertiary}
        autoCapitalize="characters"
        autoCorrect={false}
        selectTextOnFocus
        onChangeText={(text) => onChange(text === "" ? undefined : (typedLetter(text) ?? value))}
        style={[styles.input, { color: theme.text }]}
      />
    </Stepper>
  );
}

const styles = StyleSheet.create({
  box: { borderWidth: 1, borderRadius: 12, overflow: "hidden" },
  step: { height: 26, alignItems: "center", justifyContent: "center" },
  rule: { height: StyleSheet.hairlineWidth },
  pressed: { opacity: 0.5 },
  input: { height: 36, paddingHorizontal: 2, textAlign: "center", fontFamily: Fonts.body, fontSize: 17, fontWeight: 600, fontVariant: ["tabular-nums"] },
});
