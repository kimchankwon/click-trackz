import { useQuery } from "convex/react";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet } from "react-native";

import { SongForm } from "@/components/song/song-form";
import { ThemedView } from "@/components/themed-view";
import { GoneNotice } from "@/components/ui/gone-notice";
import { backOr } from "@/lib/back-or";
import { useGuestStaysWhileEditing } from "@/presence/use-presence";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";

export default function SongEditorScreen() {
  const params = useLocalSearchParams<{ groupId: string; songId: string }>();
  const songId = params.songId as Id<"songs">;
  const groupId = params.groupId as Id<"groups">;
  const song = useQuery(api.songs.get, { songId });
  const vocabulary = useQuery(api.vocabulary.list, { groupId });
  useGuestStaysWhileEditing(groupId);
  const [deletingHere, setDeletingHere] = useState(false);
  const gone = song === null;
  useEffect(() => {
    if (gone && deletingHere) backOr({ pathname: "/group/[groupId]", params: { groupId } });
  }, [gone, deletingHere, groupId]);
  if (gone && !deletingHere) {
    return (
      <GoneNotice
        title="This Song is gone"
        message="It was deleted from the Group, so there is nothing left to edit."
        action="Back to the Group"
        onPress={() => backOr({ pathname: "/group/[groupId]", params: { groupId } })}
        testID="song-gone"
      />
    );
  }
  if (!song || !vocabulary) return <ThemedView style={styles.container} />;
  return <SongForm key={songId} groupId={groupId} songId={songId} song={song} vocabulary={vocabulary} onDeleting={setDeletingHere} />;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
