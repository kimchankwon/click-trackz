import { useMutation, useQuery } from "convex/react";
import * as DocumentPicker from "expo-document-picker";
import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { ActionButton } from "@/components/action-button";
import { Card, Divider } from "@/components/group/card";
import { ThemedText } from "@/components/themed-text";
import { Field } from "@/components/ui/field";
import { IconButton } from "@/components/ui/icon-button";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

type Props = {
  groupId: Id<"groups">;
  onPreview: (key: string) => void;
  canPreview: boolean;
  run: (action: () => Promise<unknown>) => void;
};

export function VoicePackCard({ groupId, onPreview, canPreview, run }: Props) {
  const recordings = useQuery(api.recordings.list, { groupId });
  const generateUploadUrl = useMutation(api.recordings.generateUploadUrl);
  const save = useMutation(api.recordings.save);
  const remove = useMutation(api.recordings.remove);
  const theme = useTheme();
  const [word, setWord] = useState("");
  const [number, setNumber] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  const upload = () =>
    run(async () => {
      const picked = await DocumentPicker.getDocumentAsync({ type: "audio/*", copyToCacheDirectory: true });
      if (picked.canceled) return;
      const asset = picked.assets[0];
      const blob = await (await fetch(asset.uri)).blob();
      const uploadUrl = await generateUploadUrl({ groupId });
      const response = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": asset.mimeType ?? blob.type ?? "audio/wav" },
        body: blob,
      });
      if (!response.ok) throw new Error(`Upload failed (${response.status})`);
      const { storageId } = (await response.json()) as { storageId: Id<"_storage"> };
      const result = await save({ groupId, word, number: number.trim() ? Number(number) : undefined, storageId });
      setStatus(result.ok ? `Saved ${result.key}` : result.error);
    });

  return (
    <Card title="Voice pack">
      <ThemedText type="caption" themeColor="textSecondary">
        Your recordings replace the Speaker for every Member. A new word becomes a Section type for this Group.
      </ThemedText>
      {(recordings ?? []).length > 0 ? (
        <View>
          {(recordings ?? []).map((recording, index) => (
            <View key={recording.key} style={styles.recording} testID={`recording-${recording.key}`}>
              {index > 0 ? <View style={[styles.separator, { backgroundColor: theme.border }]} /> : null}
              <ThemedText style={[styles.grow, styles.word]}>
                {recording.word}
                {recording.number ? ` ${recording.number}` : ""}
              </ThemedText>
              {canPreview ? (
                <IconButton icon="play" color="text" filled onCard round size={40} label={`Play ${recording.word}`} testID={`play-${recording.key}`} onPress={() => onPreview(recording.key)} />
              ) : null}
              <IconButton
                icon="trash"
                size={40}
                round
                outlined
                label={`Remove ${recording.word}`}
                color="textTertiary"
                testID={`remove-${recording.key}`}
                onPress={() => run(() => remove({ groupId, key: recording.key }))}
              />
            </View>
          ))}
        </View>
      ) : null}
      {!canPreview && (recordings ?? []).length > 0 ? (
        <ThemedText type="caption" themeColor="textSecondary" testID="voice-pack-preview-hint">
          Enable sound to play these recordings.
        </ThemedText>
      ) : null}
      <Divider />
      <View style={styles.row}>
        <Field label="Word" testID="recording-word" containerStyle={styles.grow} value={word} onChangeText={setWord} placeholder="e.g. Chorus" compact />
        <Field label="Number" testID="recording-number" containerStyle={styles.numberInput} value={number} onChangeText={setNumber} placeholder="1-9" inputMode="numeric" compact />
      </View>
      <ActionButton icon="upload" accent label="Upload recording" testID="upload-recording" onPress={upload} disabled={word.trim() === ""} />
      {status ? (
        <ThemedText type="caption" themeColor="textSecondary" testID="recording-status">
          {status}
        </ThemedText>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: Spacing.two },
  recording: { flexDirection: "row", alignItems: "center", gap: 12, height: 56 },
  separator: { position: "absolute", top: 0, left: 0, right: 0, height: StyleSheet.hairlineWidth },
  word: { fontSize: 17, fontWeight: 600 },
  grow: { flex: 1, minWidth: 0 },
  numberInput: { width: 88 },
});
