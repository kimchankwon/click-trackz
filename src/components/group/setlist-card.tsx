import { useMutation, useQuery } from "convex/react";
import { router } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { Card } from "@/components/group/card";
import { Chip } from "@/components/group/chip";
import { SongRow } from "@/components/group/song-row";
import { ActionButton } from "@/components/action-button";
import { ThemedText } from "@/components/themed-text";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
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
  const theme = useTheme();
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
              <ActionButton
                small
                variant="ghost"
                icon="edit"
                label="Edit"
                accessibleName="Edit this Setlist"
                testID="edit-setlist"
                onPress={() => router.push({ pathname: "/group/[groupId]/setlist/[setlistId]", params: { groupId, setlistId: shown.setlistId } })}
              />
            ) : null}
            <ActionButton small variant="ghost" icon="add" label="New" accessibleName="New Setlist" testID="new-setlist" onPress={createAndOpen} />
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
          {entries.some((entry) => entry.needsStructure) ? (
            <View style={styles.legend}>
              <View style={[styles.legendDot, { backgroundColor: theme.warning }]} />
              <ThemedText type="caption" themeColor="textSecondary">
                No Sections yet, so it cannot start
              </ThemedText>
            </View>
          ) : null}
          {entries.map((entry, index) => (
            <SongRow
              key={`${entry.songId}-${index}`}
              index={index + 1}
              title={entry.title}
              meta={entry.leader ? `Led by ${entry.leader}` : null}
              songKey={entry.key}
              needsSections={entry.needsStructure}
              warningAsDot
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
  actions: { flexDirection: "row", gap: 0 },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.two, alignItems: "center" },
  list: { marginHorizontal: -Spacing.two, gap: 2 },
  legend: { flexDirection: "row", alignItems: "center", gap: Spacing.two, paddingHorizontal: Spacing.two, paddingBottom: Spacing.one },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
});
