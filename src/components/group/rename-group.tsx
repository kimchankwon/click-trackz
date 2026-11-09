import { useMutation } from "convex/react";
import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { ActionButton } from "@/components/action-button";
import { ThemedText } from "@/components/themed-text";
import { Field } from "@/components/ui/field";
import { Spacing } from "@/constants/theme";
import { errorText } from "@/lib/error-text";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

export function RenameGroup({ groupId, name }: { groupId: Id<"groups">; name: string }) {
  const rename = useMutation(api.groups.rename);
  const [draft, setDraft] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const save = async () => {
    if (draft === null || saving) return;
    setError(null);
    setSaving(true);
    try {
      await rename({ groupId, name: draft });
      setDraft(null);
    } catch (failure) {
      setError(errorText(failure));
    } finally {
      setSaving(false);
    }
  };
  if (draft === null) {
    return (
      <ActionButton
        icon="edit"
        label="Rename Group"
        testID="rename-group"
        onPress={() => {
          setError(null);
          setDraft(name);
        }}
      />
    );
  }
  return (
    <View style={styles.editor}>
      <Field
        label="Group name"
        testID="group-name-draft"
        value={draft}
        onChangeText={setDraft}
        autoCapitalize="words"
        autoFocus
        inset
        onSubmitEditing={() => void save()}
      />
      {error ? (
        <ThemedText type="caption" themeColor="danger" testID="group-name-error">
          {error}
        </ThemedText>
      ) : null}
      <View style={styles.buttons}>
        <ActionButton small label="Cancel" testID="group-name-cancel" disabled={saving} onPress={() => setDraft(null)} />
        <ActionButton
          small
          accent
          label={saving ? "Saving…" : "Save name"}
          accessibleName="Save Group name"
          testID="group-name-save"
          pending={saving}
          disabled={draft.trim().length === 0}
          onPress={() => void save()}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  editor: { width: "100%", gap: Spacing.two },
  buttons: { flexDirection: "row", justifyContent: "flex-end", gap: Spacing.two },
});
