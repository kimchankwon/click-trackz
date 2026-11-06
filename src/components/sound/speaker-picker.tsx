import { StyleSheet, View } from "react-native";

import { speakers, type SpeakerId } from "@/audio/builtin-voice-clips";
import { Chip } from "@/components/group/chip";
import { Spacing } from "@/constants/theme";

export function SpeakerPicker({ value, onChange }: { value: SpeakerId; onChange: (next: SpeakerId) => void }) {
  return (
    <View style={styles.grid} role="radiogroup" aria-label="Speaker" testID="speaker-picker">
      {speakers.map((option) => (
        <View key={option.id} style={styles.cell}>
          <Chip role="radio" label={option.name} testID={`speaker-${option.id}`} selected={value === option.id} onPress={() => onChange(option.id)} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.two },
  cell: { flexBasis: "30%", flexGrow: 1 },
});
