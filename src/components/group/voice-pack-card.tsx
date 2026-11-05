import { useMutation, useQuery } from "convex/react";
import * as DocumentPicker from "expo-document-picker";
import { useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
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
  const input = [styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }];

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
    <View style={[styles.card, { borderColor: theme.backgroundSelected }]}>
      <ThemedText type="smallBold" themeColor="textSecondary">
        VOICE PACK
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        Your recordings replace the Speaker for every Member. A new word becomes a Section type for this Group.
      </ThemedText>
      {(recordings ?? []).map((recording) => (
        <View key={recording.key} style={styles.row} testID={`recording-${recording.key}`}>
          <ThemedText style={styles.grow}>
            {recording.word}
            {recording.number ? ` ${recording.number}` : ""}
          </ThemedText>
          {canPreview ? (
            <Pressable
              role="button"
              testID={`play-${recording.key}`}
              onPress={() => onPreview(recording.key)}
              style={[styles.small, { backgroundColor: theme.backgroundElement }]}
            >
              <ThemedText type="small">Play</ThemedText>
            </Pressable>
          ) : null}
          <Pressable
            role="button"
            testID={`remove-${recording.key}`}
            onPress={() => run(() => remove({ groupId, key: recording.key }))}
            style={[styles.small, { backgroundColor: theme.backgroundElement }]}
          >
            <ThemedText type="small">Remove</ThemedText>
          </Pressable>
        </View>
      ))}
      {!canPreview && (recordings ?? []).length > 0 ? (
        <ThemedText type="small" themeColor="textSecondary" testID="voice-pack-preview-hint">
          Enable sound to play these recordings.
        </ThemedText>
      ) : null}
      <View style={styles.row}>
        <TextInput testID="recording-word" style={[input, styles.grow]} value={word} onChangeText={setWord} placeholder="Word, e.g. Chorus" placeholderTextColor={theme.textSecondary} />
        <TextInput testID="recording-number" style={[input, styles.numberInput]} value={number} onChangeText={setNumber} placeholder="#" inputMode="numeric" placeholderTextColor={theme.textSecondary} />
        <Pressable role="button" testID="upload-recording" onPress={upload} style={[styles.small, { backgroundColor: theme.accent }]}>
          <ThemedText type="small" style={{ color: theme.onAccent }}>
            Upload
          </ThemedText>
        </Pressable>
      </View>
      {status ? (
        <ThemedText type="small" themeColor="textSecondary" testID="recording-status">
          {status}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { width: "100%", gap: Spacing.three, padding: Spacing.three, borderWidth: 1, borderRadius: Spacing.four },
  row: { flexDirection: "row", alignItems: "center", gap: Spacing.two },
  grow: { flex: 1, minWidth: 0 },
  input: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, borderRadius: Spacing.three, fontSize: 16 },
  numberInput: { width: 56 },
  small: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, borderRadius: Spacing.three },
});
