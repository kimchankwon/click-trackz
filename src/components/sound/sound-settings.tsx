import { router } from "expo-router";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import type { SpeakerId } from "@/audio/builtin-voice-clips";
import { Card, Divider } from "@/components/group/card";
import { VolumeBar } from "@/components/playback/volume-bar";
import { SpeakerPicker } from "@/components/sound/speaker-picker";
import { ThemedText } from "@/components/themed-text";
import { Icon } from "@/components/ui/icon";
import { MetronomeIcon } from "@/components/ui/metronome-icon";
import { Switch } from "@/components/ui/switch";
import { Spacing } from "@/constants/theme";
import { isLatencySetting } from "@/settings/latency";
import { useDeviceSetting } from "@/settings/use-device-setting";
import type { Sound } from "@/settings/use-sound-settings";

const MIX_TEXT_INSET = 38;

export function SoundSettings({
  sound,
  update,
  saveError,
  prompt,
  speakerHint,
  onSpeaker,
}: {
  sound: Sound;
  update: (patch: Partial<Sound>) => void;
  saveError: string | null;
  prompt?: ReactNode;
  speakerHint?: string | null;
  onSpeaker?: (speaker: SpeakerId) => void;
}) {
  const [latencyNudge] = useDeviceSetting("latencyNudgeMs", "0", isLatencySetting);
  return (
    <>
      {prompt}
      <Card title="Mix">
        <View style={styles.mixRow}>
          <View style={styles.mixHead}>
            <MetronomeIcon size={22} />
            <View style={styles.grow}>
              <Switch label="Click" value={sound.click} onChange={(on) => update({ click: on })} />
            </View>
          </View>
          <View style={styles.mixSlider}>
            <VolumeBar label="Click" bare testID="click-volume" value={sound.clickVolume} onChange={(next) => update({ clickVolume: Number(next.toFixed(2)) })} />
          </View>
        </View>
        <Divider inset={MIX_TEXT_INSET} />
        <View style={styles.mixRow}>
          <View style={styles.mixHead}>
            <Icon name="speaking" size={22} color="textSecondary" />
            <View style={styles.grow}>
              <Switch label="Voice cues" value={sound.voiceCues} onChange={(on) => update({ voiceCues: on })} />
            </View>
          </View>
          <View style={styles.mixSlider}>
            <VolumeBar label="Voice" bare testID="voice-volume" value={sound.voiceVolume} onChange={(next) => update({ voiceVolume: Number(next.toFixed(2)) })} />
          </View>
        </View>
        <Divider inset={MIX_TEXT_INSET} />
        <View style={styles.mixHead}>
          <Icon name="numbered" size={22} color="textSecondary" />
          <View style={styles.grow}>
            <Switch label="Spoken counts" hint="Uses the Voice volume" value={sound.spokenCounts} onChange={(on) => update({ spokenCounts: on })} />
          </View>
        </View>
      </Card>
      <Card title="Speaker" plain>
        <SpeakerPicker
          value={sound.speaker}
          onChange={(speaker) => {
            update({ speaker });
            onSpeaker?.(speaker);
          }}
        />
        {speakerHint ? (
          <ThemedText type="caption" themeColor="textSecondary" testID="speaker-preview-hint" style={styles.plainHint}>
            {speakerHint}
          </ThemedText>
        ) : null}
      </Card>
      <Card title="Timing" tight>
        <Pressable role="link" testID="open-latency" onPress={() => router.push("/latency")} style={styles.linkRow}>
          <Icon name="headphones" size={22} color="textSecondary" />
          <View style={styles.grow}>
            <ThemedText style={styles.rowTitle}>Latency nudge</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              For Bluetooth audio on this device
            </ThemedText>
          </View>
          <ThemedText themeColor="textSecondary" style={styles.latencyValue}>
            {latencyNudge} ms
          </ThemedText>
          <Icon name="forward" size={20} color="textTertiary" />
        </Pressable>
      </Card>
      <ThemedText type="caption" themeColor={saveError ? "danger" : "textSecondary"} testID="sound-saved-caption" style={styles.caption}>
        {saveError ?? "Saved to your account, so every Group and device uses the same sound."}
      </ThemedText>
    </>
  );
}

const styles = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
  mixSlider: { paddingLeft: MIX_TEXT_INSET },
  mixRow: { gap: Spacing.one },
  mixHead: { flexDirection: "row", alignItems: "center", gap: Spacing.three },
  plainHint: { paddingHorizontal: Spacing.one },
  caption: { width: "100%", paddingHorizontal: Spacing.one },
  linkRow: { flexDirection: "row", alignItems: "center", gap: Spacing.three, minHeight: 64, paddingVertical: Spacing.one },
  rowTitle: { fontSize: 17, lineHeight: 22, fontWeight: 600 },
  latencyValue: { fontSize: 17, fontWeight: 600, fontVariant: ["tabular-nums"], marginRight: Spacing.two },
});
