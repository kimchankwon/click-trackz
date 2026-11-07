import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { ActionButton } from "@/components/action-button";
import { ThemedText } from "@/components/themed-text";
import { Field } from "@/components/ui/field";
import { Radius, Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

const MIN_BPM = 30;
const MAX_BPM = 300;

const clampBpm = (bpm: number) => Math.min(MAX_BPM, Math.max(MIN_BPM, Math.round(bpm)));

export function TempoPanel({
  bpm,
  ownTempoCount,
  onSave,
  onClose,
}: {
  bpm: number;
  ownTempoCount: number;
  onSave: (bpm: number) => Promise<void>;
  onClose: () => void;
}) {
  const theme = useTheme();
  const [value, setValue] = useState(clampBpm(bpm));
  const [draft, setDraft] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const nudge = (by: number) => {
    setDraft(null);
    setValue(clampBpm(value + by));
  };
  const save = () => {
    setSaving(true);
    setProblem(null);
    onSave(value)
      .then(onClose)
      .catch(() => setProblem("The Song tempo was not saved. Check your connection and try again."))
      .finally(() => setSaving(false));
  };
  return (
    <View style={[styles.panel, { backgroundColor: theme.backgroundElement }]} testID="tempo-panel">
      <ThemedText type="smallBold" role="heading">
        Song tempo
      </ThemedText>
      <View style={styles.row}>
        <ActionButton small variant="outline" label="−5" accessibleName="5 BPM slower" testID="tempo-down-5" onPress={() => nudge(-5)} />
        <ActionButton small variant="outline" label="−1" accessibleName="1 BPM slower" testID="tempo-down-1" onPress={() => nudge(-1)} />
        <Field
          testID="tempo-input"
          aria-label="Song tempo in BPM"
          value={draft ?? String(value)}
          inputMode="numeric"
          onChangeText={(next) => {
            setDraft(next);
            const parsed = Number(next);
            if (next.trim() !== "" && Number.isFinite(parsed) && parsed >= MIN_BPM && parsed <= MAX_BPM) setValue(Math.round(parsed));
          }}
          onBlur={() => setDraft(null)}
          containerStyle={styles.value}
          style={styles.valueInput}
          compact
        />
        <ActionButton small variant="outline" label="+1" accessibleName="1 BPM faster" testID="tempo-up-1" onPress={() => nudge(1)} />
        <ActionButton small variant="outline" label="+5" accessibleName="5 BPM faster" testID="tempo-up-5" onPress={() => nudge(5)} />
      </View>
      <ThemedText type="caption" themeColor="textSecondary">
        {ownTempoCount > 0
          ? `Every Section plays at this tempo, except ${ownTempoCount === 1 ? "the one" : `the ${ownTempoCount}`} with Own tempo.`
          : "Every Section plays at this tempo."}
      </ThemedText>
      {problem ? (
        <ThemedText type="caption" themeColor="danger" testID="tempo-problem">
          {problem}
        </ThemedText>
      ) : null}
      <View style={styles.row}>
        <ActionButton variant="secondary" label="Cancel" testID="tempo-cancel" full onPress={onClose} />
        <ActionButton accent label={saving ? "Saving…" : "Save"} testID="tempo-save" full pending={saving} onPress={save} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { width: "100%", gap: Spacing.three, padding: Spacing.three, borderRadius: Radius.lg },
  row: { flexDirection: "row", alignItems: "center", gap: Spacing.two },
  value: { flex: 1, minWidth: 0 },
  valueInput: { textAlign: "center", fontSize: 22, fontWeight: 700, fontVariant: ["tabular-nums"] },
});
