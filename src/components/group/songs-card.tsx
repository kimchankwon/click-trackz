import { useMutation, useQuery } from "convex/react";
import { router } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { ActionButton } from "@/components/action-button";
import { Card, Divider } from "@/components/group/card";
import { SongRow } from "@/components/group/song-row";
import { ThemedText } from "@/components/themed-text";
import { Field } from "@/components/ui/field";
import { IconButton } from "@/components/ui/icon-button";
import { Spacing } from "@/constants/theme";
import { summaryParts } from "@/sync/song-summary";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

export function SongsCard({
  groupId,
  isAdmin,
  canPlay,
  selectedSongId,
  onPlay,
  run,
}: {
  groupId: Id<"groups">;
  isAdmin: boolean;
  canPlay: boolean;
  selectedSongId: Id<"songs"> | null;
  onPlay: (songId: Id<"songs">) => void;
  run: (action: () => Promise<unknown>) => void;
}) {
  const songs = useQuery(api.songs.list, { groupId });
  const createSong = useMutation(api.songs.createSong);
  const [title, setTitle] = useState("");
  const list = songs ?? [];
  return (
    <Card title={`Song library (${list.length})`}>
      {list.length === 0 ? (
        <ThemedText type="small" themeColor="textSecondary">
          No Songs yet.
        </ThemedText>
      ) : (
        <View style={styles.list}>
          {list.map((song, index) => (
            <SongRow
              divider={index > 0}
              key={song.songId}
              title={song.title}
              meta={[selectedSongId === song.songId ? "On Play" : null, ...summaryParts(song).shown].filter((part): part is string => part !== null)}
              metaLabel={[selectedSongId === song.songId ? "On Play" : null, ...summaryParts(song).spoken].filter(Boolean).join(", ") || null}
              songKey={song.key}
              showKey={false}
              needsSections={song.sectionCount === 0}
              selected={false}
              selectable={isAdmin}
              opens
              label={`Edit ${song.title}`}
              onSelect={() => router.push({ pathname: "/group/[groupId]/song/[songId]", params: { groupId, songId: song.songId } })}
              testID={`edit-${song.title}`}
              trailing={
                canPlay ? (
                  <IconButton
                    icon="play"
                    label={selectedSongId === song.songId ? `Play ${song.title}, already on Play` : `Play ${song.title}`}
                    testID={`play-${song.title}`}
                    color={selectedSongId === song.songId ? "accent" : "textSecondary"}
                    onPress={() => onPlay(song.songId)}
                  />
                ) : null
              }
            />
          ))}
        </View>
      )}
      {isAdmin ? (
        <>
          <Divider />
          <View style={styles.addRow}>
            <Field
              testID="new-song-title"
              value={title}
              onChangeText={setTitle}
              placeholder="New Song title"
              containerStyle={styles.grow}
              compact
              inset
            />
            <ActionButton
              small
              accent
              icon="add"
              label="Add"
              testID="add-song"
              disabled={title.trim() === ""}
              onPress={() =>
                run(async () => {
                  const songId = await createSong({ groupId, title });
                  setTitle("");
                  router.push({ pathname: "/group/[groupId]/song/[songId]", params: { groupId, songId } });
                })
              }
            />
          </View>
        </>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  list: { marginHorizontal: -Spacing.two, gap: 2 },
  addRow: { flexDirection: "row", alignItems: "center", gap: Spacing.two },
  grow: { flex: 1 },
});
