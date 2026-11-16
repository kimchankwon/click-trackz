import { StyleSheet, View } from "react-native";

import { speakers, type SpeakerId } from "@/audio/builtin-voice-clips";
import { Chip } from "@/components/group/chip";
import { Spacing } from "@/constants/theme";

const columns = [speakers.filter((option) => option.voice === "female"), speakers.filter((option) => option.voice === "male")] as const;

export function SpeakerPicker({ value, onChange }: { value: SpeakerId; onChange: (next: SpeakerId) => void }) {
  return (
    <View style={styles.columns} role="radiogroup" aria-label="Speaker" testID="speaker-picker">
      {columns.map((column, at) => (
        <View key={at} style={styles.column} testID={at === 0 ? "speaker-column-female" : "speaker-column-male"}>
          {column.map((option) => (
            <Chip key={option.id} role="radio" label={option.name} testID={`speaker-${option.id}`} selected={value === option.id} onPress={() => onChange(option.id)} />
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  columns: { flexDirection: "row", alignItems: "flex-start", gap: Spacing.two },
  column: { flex: 1, minWidth: 0, gap: Spacing.two },
});
