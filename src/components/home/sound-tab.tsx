import { useIsFocused } from "expo-router";
import { StyleSheet, View } from "react-native";

import { useSpeakerPreview } from "@/audio/use-speaker-preview";
import { SoundSettings } from "@/components/sound/sound-settings";
import { ThemedText } from "@/components/themed-text";
import { Spacing } from "@/constants/theme";
import { useSoundSettings } from "@/settings/use-sound-settings";

export function SoundTab({ active }: { active: boolean }) {
  const { sound, update, saveError } = useSoundSettings();
  const focused = useIsFocused();
  const preview = useSpeakerPreview(active && focused, sound.voiceVolume);
  return (
    <>
      <View style={styles.pageHead}>
        <ThemedText type="title" role="heading">
          Sound
        </ThemedText>
      </View>
      <SoundSettings sound={sound} update={update} saveError={saveError} speakerHint="Tap a Speaker to hear it." onSpeaker={preview} />
    </>
  );
}

const styles = StyleSheet.create({
  pageHead: { gap: Spacing.one },
});
