import type { ReactNode } from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";

import { ActionButton } from "@/components/action-button";
import { ThemedText } from "@/components/themed-text";
import { MaxContentWidth, Radius, Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel,
  pending,
  error,
  onConfirm,
  onCancel,
  testID,
  children,
}: {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  pending?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
  testID?: string;
  children?: ReactNode;
}) {
  const theme = useTheme();
  const cancel = () => onCancel();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={cancel}>
      <View style={styles.layer}>
        <Pressable aria-label="Cancel" style={[StyleSheet.absoluteFill, styles.scrim]} onPress={cancel} />
        <View role="alertdialog" aria-modal aria-label={title} testID={testID} style={[styles.dialog, { backgroundColor: theme.backgroundElement }]}>
          <ThemedText type="subtitle" style={styles.title}>
            {title}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {message}
          </ThemedText>
          {children}
          {error ? (
            <ThemedText type="small" themeColor="danger" role="alert" testID={testID ? `${testID}-error` : undefined}>
              {error}
            </ThemedText>
          ) : null}
          <View style={styles.actions}>
            <ActionButton full label="Cancel" testID={testID ? `${testID}-cancel` : undefined} onPress={cancel} />
            <ActionButton
              full
              accent
              label={confirmLabel}
              testID={testID ? `${testID}-confirm` : undefined}
              pending={pending}
              onPress={onConfirm}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  layer: { flex: 1, alignItems: "center", justifyContent: "center", padding: Spacing.four },
  scrim: { backgroundColor: "rgba(0, 0, 0, 0.5)" },
  dialog: { width: "100%", maxWidth: MaxContentWidth * 0.7, gap: Spacing.three, padding: Spacing.four, borderRadius: Radius.lg },
  title: { fontSize: 22, lineHeight: 28 },
  actions: { flexDirection: "row", gap: Spacing.two, marginTop: Spacing.two },
});
