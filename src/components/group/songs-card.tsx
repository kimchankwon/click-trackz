import { useMutation, useQuery } from "convex/react";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { ActionButton } from "@/components/action-button";
import { Card, Divider } from "@/components/group/card";
import { SongRow } from "@/components/group/song-row";
import { ThemedText } from "@/components/themed-text";
import { Field } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { IconButton } from "@/components/ui/icon-button";
import { Spacing } from "@/constants/theme";
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
  const setlists = useQuery(api.setlists.list, { groupId });
  const [expandedChoice, setExpandedChoice] = useState<boolean | null>(null);
  const expanded = expandedChoice ?? (setlists !== undefined && setlists.length === 0);
  const createSong = useMutation(api.songs.createSong);
  const [title, setTitle] = useState("");
  const list = songs ?? [];
  return (
    <Card
      title="Song library"
      action={
        expanded ? (
          <ActionButton small variant="link" icon="up" label="Hide" testID="toggle-library" onPress={() => setExpandedChoice(false)} />
        ) : null
      }
    >
      {!expanded ? (
        <Pressable role="button" aria-expanded={false} testID="toggle-library" onPress={() => setExpandedChoice(true)} style={styles.collapsed}>
          <Icon name="library" size={22} color="textSecondary" />
          <ThemedText style={styles.collapsedText}>
            {list.length} {list.length === 1 ? "Song" : "Songs"}
          </ThemedText>
          <Icon name="forward" size={22} color="textTertiary" />
        </Pressable>
      ) : list.length === 0 ? (
        <ThemedText type="small" themeColor="textSecondary">
          No Songs yet.
        </ThemedText>
      ) : (
        <View style={styles.list}>
          {list.map((song) => (
            <SongRow
              key={song.songId}
              title={song.title}
              meta={song.sectionCount === 0 ? null : `${song.sectionCount} Sections`}
              songKey={song.key}
              needsSections={song.sectionCount === 0}
              selected={selectedSongId === song.songId}
              selectable={isAdmin}
              onSelect={() => onSelect(song.songId)}
              testID={`song-${song.title}`}
              trailing={
                isAdmin ? (
                  <IconButton
                    icon="forward"
                    label={`Edit ${song.title}`}
                    testID={`edit-${song.title}`}
                    color="textSecondary"
                    onPress={() => router.push({ pathname: "/group/[groupId]/song/[songId]", params: { groupId, songId: song.songId } })}
                  />
                ) : null
              }
            />
          ))}
        </View>
      )}
      {isAdmin && expanded ? (
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
  collapsed: { flexDirection: "row", alignItems: "center", gap: Spacing.three, minHeight: 32 },
  collapsedText: { flex: 1, fontSize: 17, fontWeight: 600 },
});
