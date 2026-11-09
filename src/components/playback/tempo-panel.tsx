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

const typedBpm = (text: string) => {
  const parsed = Number(text);
  return text.trim() !== "" && Number.isFinite(parsed) && parsed >= MIN_BPM && parsed <= MAX_BPM ? Math.round(parsed) : null;
};

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
  const [value, setValue] = useState(Math.min(MAX_BPM, Math.max(MIN_BPM, bpm)));
  const [draft, setDraft] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const nudge = (by: number) => {
    setDraft(null);
    setProblem(null);
    setValue(clampBpm(value + by));
  };
  const save = () => {
    const bpm = draft === null ? value : typedBpm(draft);
    if (bpm === null) {
      setProblem(`The Song tempo must be from ${MIN_BPM} to ${MAX_BPM} BPM.`);
      return;
    }
    setSaving(true);
    setProblem(null);
    onSave(bpm)
      .then(onClose)
      .catch(() => setProblem("The Song tempo was not saved. Check your connection and try again."))
      .finally(() => setSaving(false));
  };
  return (
    <View style={[styles.panel, { backgroundColor: theme.backgroundElement }]} testID="tempo-panel">
      <ThemedText type="smallBold" role="heading">
        Song tempo
      </ThemedText>
      <Field
        testID="tempo-input"
        aria-label="Song tempo in BPM"
        value={draft ?? String(value)}
        inputMode="numeric"
        onChangeText={(next) => {
          setDraft(next);
          setProblem(null);
          const typed = typedBpm(next);
          if (typed !== null) setValue(typed);
        }}
        onBlur={() => {
          if (draft !== null && typedBpm(draft) !== null) setDraft(null);
        }}
        style={styles.valueInput}
      />
      <View style={styles.row}>
        <ActionButton small full variant="outline" label="−5" accessibleName="5 BPM slower" testID="tempo-down-5" onPress={() => nudge(-5)} />
        <ActionButton small full variant="outline" label="−1" accessibleName="1 BPM slower" testID="tempo-down-1" onPress={() => nudge(-1)} />
        <ActionButton small full variant="outline" label="+1" accessibleName="1 BPM faster" testID="tempo-up-1" onPress={() => nudge(1)} />
        <ActionButton small full variant="outline" label="+5" accessibleName="5 BPM faster" testID="tempo-up-5" onPress={() => nudge(5)} />
      </View>
      {ownTempoCount > 0 ? (
        <ThemedText type="caption" themeColor="textSecondary">
          {ownTempoCount === 1 ? "One Section keeps its Own tempo." : `${ownTempoCount} Sections keep their Own tempo.`}
        </ThemedText>
      ) : null}
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
  valueInput: { textAlign: "center", fontSize: 22, fontWeight: 700, fontVariant: ["tabular-nums"] },
});
