import { useMutation, useQuery } from "convex/react";
import { router } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { Card } from "@/components/group/card";
import { Chip } from "@/components/group/chip";
import { SongRow } from "@/components/group/song-row";
import { ThemedText } from "@/components/themed-text";
import { IconButton } from "@/components/ui/icon-button";
import { Spacing } from "@/constants/theme";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

export function SetlistCard({
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
  const setlists = useQuery(api.setlists.list, { groupId });
  const createSetlist = useMutation(api.setlists.createSetlist);
  const [shownId, setShownId] = useState<Id<"setlists"> | null>(null);
  const current = setlists?.find((s) => s.isCurrent) ?? null;
  const shown = setlists?.find((s) => s.setlistId === shownId) ?? current ?? setlists?.[0] ?? null;
  const setlist = useQuery(api.setlists.get, shown ? { setlistId: shown.setlistId } : "skip");
  if (!setlists || (setlists.length === 0 && !isAdmin)) return null;
  const entries = setlist?.entries ?? [];
  const createAndOpen = () =>
    run(async () => {
      const setlistId = await createSetlist({ groupId, name: "New Setlist" });
      router.push({ pathname: "/group/[groupId]/setlist/[setlistId]", params: { groupId, setlistId } });
    });
  return (
    <Card
      title={shown ? `Setlist · ${shown.name}` : "Setlist"}
      action={
        isAdmin ? (
          <View style={styles.actions}>
            {shown ? (
              <IconButton
                icon="edit"
                label="Edit this Setlist"
                testID="edit-setlist"
                onPress={() => router.push({ pathname: "/group/[groupId]/setlist/[setlistId]", params: { groupId, setlistId: shown.setlistId } })}
              />
            ) : null}
            <IconButton icon="add" label="New Setlist" testID="new-setlist" onPress={createAndOpen} />
          </View>
        ) : null
      }
    >
      {setlists.length > 1 ? (
        <View style={styles.wrap}>
          {setlists.map((option) => (
            <Chip
              key={option.setlistId}
              role="radio"
              icon={option.isCurrent ? "star" : undefined}
              label={option.name}
              selected={shown?.setlistId === option.setlistId}
              onPress={() => setShownId(option.setlistId)}
              testID={`setlist-${option.name}`}
            />
          ))}
        </View>
      ) : null}
      {setlists.length === 0 ? (
        <ThemedText type="small" themeColor="textSecondary">
          No Setlists yet. Tap + to plan what the Group plays.
        </ThemedText>
      ) : entries.length === 0 ? (
        <ThemedText type="small" themeColor="textSecondary">
          This Setlist is empty. Tap the pencil to add Songs.
        </ThemedText>
      ) : (
        <View style={styles.list}>
          {entries.map((entry, index) => (
            <SongRow
              key={`${entry.songId}-${index}`}
              index={index + 1}
              title={entry.title}
              meta={entry.leader ? `Led by ${entry.leader}` : null}
              songKey={entry.key}
              needsSections={entry.needsStructure}
              selected={selectedSongId === entry.songId}
              selectable={isAdmin}
              onSelect={() => onSelect(entry.songId)}
              testID={`setlist-entry-${index}`}
            />
          ))}
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: "row", gap: Spacing.one },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.two, alignItems: "center" },
  list: { marginHorizontal: -Spacing.two, gap: 2 },
});
