import { useMutation, useQuery } from "convex/react";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";

import { Card } from "@/components/group/card";
import { ThemedText } from "@/components/themed-text";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

export function SongsCard({
  groupId,
  isAdmin,
  selectedSongId,
  onSelect,
  run,
}: {
  groupId: Id<"groups">;
  isAdmin: boolean;
  selectedSongId: Id<"songs"> | null;
  onSelect: (songId: Id<"songs">) => void;
  run: (action: () => Promise<unknown>) => void;
}) {
  const songs = useQuery(api.songs.list, { groupId });
  const createSong = useMutation(api.songs.createSong);
  const theme = useTheme();
  const [title, setTitle] = useState("");
  return (
    <Card title="SONGS">
      {(songs ?? []).map((song) => (
        <View key={song.songId} style={styles.memberRow}>
          <Pressable
            role={isAdmin ? "radio" : undefined}
            aria-checked={isAdmin ? selectedSongId === song.songId : undefined}
            testID={`song-${song.title}`}
            onPress={() => (isAdmin ? onSelect(song.songId) : undefined)}
            style={styles.memberName}
          >
            <ThemedText type={selectedSongId === song.songId ? "smallBold" : "default"}>
              {selectedSongId === song.songId ? "▶ " : ""}
              {song.title}
              {song.key ? ` · ${song.key}` : ""}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {song.sectionCount === 0 ? "needs structure" : `${song.sectionCount} Sections`}
            </ThemedText>
          </Pressable>
          {isAdmin ? (
            <Pressable
              role="link"
              testID={`edit-${song.title}`}
              onPress={() =>
                router.push({ pathname: "/group/[groupId]/song/[songId]", params: { groupId, songId: song.songId } })
              }
              style={[styles.smallButton, { backgroundColor: theme.backgroundElement }]}
            >
              <ThemedText type="small">Edit</ThemedText>
            </Pressable>
          ) : null}
        </View>
      ))}
      {isAdmin ? (
        <View style={styles.memberRow}>
          <TextInput
            testID="new-song-title"
            value={title}
            onChangeText={setTitle}
            placeholder="New Song title"
            placeholderTextColor={theme.textSecondary}
            style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }]}
          />
          <Pressable
            role="button"
            testID="add-song"
            onPress={() =>
              run(async () => {
                const songId = await createSong({ groupId, title });
                setTitle("");
                router.push({ pathname: "/group/[groupId]/song/[songId]", params: { groupId, songId } });
              })
            }
            style={[styles.smallButton, { backgroundColor: theme.accent }]}
          >
            <ThemedText type="small" style={{ color: theme.onAccent }}>
              Add
            </ThemedText>
          </Pressable>
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  memberRow: { flexDirection: "row", alignItems: "center", gap: Spacing.three },
  memberName: { flex: 1 },
  smallButton: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.one, borderRadius: Spacing.three },
  input: { flex: 1, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, borderRadius: Spacing.three, fontSize: 16 },
});
