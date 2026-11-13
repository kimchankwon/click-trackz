import { useRef, useState, type ComponentRef, type ReactNode } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, useWindowDimensions, View, type StyleProp, type ViewStyle } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { Icon } from "@/components/ui/icon";
import { Radius, Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { OPTION_HEIGHT, placeMenu, type Anchor } from "@/lib/menu-placement";

const MENU_MAX_HEIGHT = 320;

export type DropdownOption<T extends string> = { value: T; label: string };

export type DropdownLook = "plain" | "field";

export function Dropdown<T extends string>({
  label,
  options,
  value,
  onChange,
  testID,
  disabled,
  look = "plain",
  shown,
  muted,
  menuMinWidth = 0,
  style,
}: {
  label: string;
  options: readonly DropdownOption<T>[];
  value: T;
  onChange: (next: T) => void;
  testID?: string;
  disabled?: boolean;
  look?: DropdownLook;
  shown?: ReactNode;
  muted?: boolean;
  menuMinWidth?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  const screen = useWindowDimensions();
  const trigger = useRef<ComponentRef<typeof View>>(null);
  const list = useRef<ComponentRef<typeof ScrollView>>(null);
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const open = anchor !== null;
  const selectedIndex = options.findIndex((option) => option.value === value);
  const selected = selectedIndex >= 0 ? options[selectedIndex] : undefined;
  const close = () => setAnchor(null);
  const toggle = () => {
    if (open) return close();
    trigger.current?.measureInWindow((x, y, width, height) => setAnchor({ x, y, width, height }));
  };
  const menuHeight = Math.min(MENU_MAX_HEIGHT, options.length * OPTION_HEIGHT + 2);
  const place = anchor ? placeMenu(anchor, screen, { height: menuHeight, minWidth: menuMinWidth }) : null;
  const field = look === "field";
  return (
    <View ref={trigger} collapsable={false} style={[styles.wrap, style]} testID={testID}>
      <Pressable
        role="button"
        aria-label={`${label}, ${selected?.label ?? value}`}
        aria-expanded={open}
        disabled={disabled}
        testID={testID ? `${testID}-button` : undefined}
        onPress={toggle}
        style={({ pressed }) => [
          field ? styles.fieldButton : styles.button,
          field
            ? { borderColor: theme.inputBorder, backgroundColor: pressed || open ? theme.backgroundSelected : theme.inputFill }
            : { borderColor: theme.inputBorder, backgroundColor: pressed || open ? theme.backgroundSelected : theme.background },
          muted ? styles.mutedButton : null,
          disabled ? styles.disabled : null,
        ]}
      >
        {shown ?? (
          <ThemedText
            type={field ? "default" : "smallBold"}
            themeColor={muted ? "textSecondary" : "text"}
            numberOfLines={1}
            style={[styles.grow, field ? styles.fieldText : null]}
          >
            {selected?.label ?? value}
          </ThemedText>
        )}
        <Icon name="expand" size={field ? 14 : 16} color="textSecondary" />
      </Pressable>
      <Modal visible={open} transparent animationType="none" statusBarTranslucent navigationBarTranslucent onRequestClose={close}>
        <Pressable aria-label={`Close ${label}`} style={StyleSheet.absoluteFill} onPress={close} testID={testID ? `${testID}-outside` : undefined} />
        {place ? (
          <View
            role="radiogroup"
            aria-label={label}
            style={[
              styles.menu,
              { left: place.left, top: place.top, width: place.width, height: place.height, borderColor: theme.border, backgroundColor: theme.backgroundElement, shadowColor: theme.text },
            ]}
          >
            <ScrollView
              ref={list}
              keyboardShouldPersistTaps="handled"
              onLayout={() => {
                if (selectedIndex <= 0) return;
                const y = Math.max(0, selectedIndex * OPTION_HEIGHT - (place.height - OPTION_HEIGHT) / 2);
                list.current?.scrollTo({ y, animated: false });
              }}
            >
              {options.map((option, index) => {
                const chosen = index === selectedIndex;
                return (
                  <Pressable
                    key={option.value}
                    role="radio"
                    aria-checked={chosen}
                    testID={testID ? `${testID}-${option.value}` : undefined}
                    onPress={() => {
                      close();
                      if (!chosen) onChange(option.value);
                    }}
                    style={({ pressed, hovered }) => [
                      styles.option,
                      index > 0 ? { borderTopColor: theme.border, borderTopWidth: StyleSheet.hairlineWidth } : null,
                      pressed || hovered ? { backgroundColor: theme.backgroundSelected } : null,
                    ]}
                  >
                    <ThemedText type="small" themeColor={chosen ? "accent" : "text"} numberOfLines={1} style={[styles.grow, chosen ? styles.chosenText : null]}>
                      {option.label}
                    </ThemedText>
                    {chosen ? <Icon name="check" size={16} color="accent" /> : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        ) : null}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignSelf: "stretch" },
  button: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
    minHeight: 40,
    paddingHorizontal: Spacing.three,
    borderWidth: 1,
    borderRadius: Radius.md,
  },
  fieldButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.half,
    minHeight: 44,
    paddingLeft: 9,
    paddingRight: 4,
    borderWidth: 1,
    borderRadius: 12,
  },
  fieldText: { fontSize: 16, fontWeight: 600, fontVariant: ["tabular-nums"] },
  mutedButton: { borderStyle: "dashed" },
  menu: {
    position: "absolute",
    borderWidth: 1,
    borderRadius: Radius.md,
    overflow: "hidden",
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  option: { flexDirection: "row", alignItems: "center", gap: Spacing.two, height: OPTION_HEIGHT, paddingHorizontal: Spacing.three },
  chosenText: { fontWeight: 600 },
  disabled: { opacity: 0.5 },
  grow: { flex: 1, minWidth: 0 },
});
