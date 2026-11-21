import { useQuery } from "convex/react";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet } from "react-native";

import { SetlistForm } from "@/components/setlist/setlist-form";
import { ThemedView } from "@/components/themed-view";
import { GoneNotice } from "@/components/ui/gone-notice";
import { backOr } from "@/lib/back-or";
import { useGuestStaysWhileEditing } from "@/presence/use-presence";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";

export default function SetlistScreen() {
  const params = useLocalSearchParams<{ groupId: string; setlistId: string }>();
  const groupId = params.groupId as Id<"groups">;
  const setlistId = params.setlistId as Id<"setlists">;
  const setlist = useQuery(api.setlists.get, { setlistId });
  const songs = useQuery(api.songs.list, { groupId });
  useGuestStaysWhileEditing(groupId);
  const [deletingHere, setDeletingHere] = useState(false);
  const gone = setlist === null;
  useEffect(() => {
    if (gone && deletingHere) backOr({ pathname: "/group/[groupId]", params: { groupId } });
  }, [gone, deletingHere, groupId]);
  if (gone && !deletingHere) {
    return (
      <GoneNotice
        title="This Setlist is gone"
        message="It was deleted from the Group, so there is nothing left to edit."
        action="Back to the Group"
        onPress={() => backOr({ pathname: "/group/[groupId]", params: { groupId } })}
        testID="setlist-gone"
      />
    );
  }
  if (!setlist || !songs) return <ThemedView style={styles.container} />;
  return (
    <SetlistForm
      key={setlistId}
      groupId={groupId}
      setlistId={setlistId}
      live={setlist}
      songs={songs}
      onDeleting={setDeletingHere}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
