import { useMutation, useQuery } from "convex/react";
import * as DocumentPicker from "expo-document-picker";
import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { ActionButton } from "@/components/action-button";
import { Card, Divider } from "@/components/group/card";
import { ThemedText } from "@/components/themed-text";
import { Field } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { IconButton } from "@/components/ui/icon-button";
import { Spacing } from "@/constants/theme";
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
      {(recordings ?? []).map((recording) => (
        <View key={recording.key} style={styles.row} testID={`recording-${recording.key}`}>
          <Icon name="mic" size={20} color="textSecondary" />
          <ThemedText type="smallBold" style={styles.grow}>
            {recording.word}
            {recording.number ? ` ${recording.number}` : ""}
          </ThemedText>
          {canPreview ? (
            <IconButton icon="play" label={`Play ${recording.word}`} testID={`play-${recording.key}`} onPress={() => onPreview(recording.key)} />
          ) : null}
          <IconButton
            icon="trash"
            label={`Remove ${recording.word}`}
            color="danger"
            testID={`remove-${recording.key}`}
            onPress={() => run(() => remove({ groupId, key: recording.key }))}
          />
        </View>
      ))}
      {!canPreview && (recordings ?? []).length > 0 ? (
        <ThemedText type="caption" themeColor="textSecondary" testID="voice-pack-preview-hint">
          Enable sound to play these recordings.
        </ThemedText>
      ) : null}
      <Divider />
      <View style={styles.row}>
        <Field testID="recording-word" containerStyle={styles.grow} value={word} onChangeText={setWord} placeholder="Word, e.g. Chorus" compact inset />
        <Field testID="recording-number" containerStyle={styles.numberInput} value={number} onChangeText={setNumber} placeholder="#" inputMode="numeric" compact inset />
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
  grow: { flex: 1, minWidth: 0 },
  numberInput: { width: 64 },
});
