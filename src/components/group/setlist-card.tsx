import { useMutation, useQuery } from "convex/react";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { Card } from "@/components/group/card";
import { Chip } from "@/components/group/chip";
import { rowStyles } from "@/components/group/row-styles";
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
  return (
    <Card title="SETLIST">
      <View style={styles.wrap}>
        {setlists.map((option) => (
          <Chip
            key={option.setlistId}
            label={`${option.name}${option.isCurrent ? " ★" : ""}`}
            selected={shown?.setlistId === option.setlistId}
            onPress={() => setShownId(option.setlistId)}
            testID={`setlist-${option.name}`}
          />
        ))}
        {isAdmin ? (
          <Chip
            role="button"
            label="+ New"
            selected={false}
            testID="new-setlist"
            onPress={() =>
              run(async () => {
                const setlistId = await createSetlist({ groupId, name: "New Setlist" });
                router.push({ pathname: "/group/[groupId]/setlist/[setlistId]", params: { groupId, setlistId } });
              })
            }
          />
        ) : null}
      </View>
      {(setlist?.entries ?? []).map((entry, index) => (
        <Pressable
          key={`${entry.songId}-${index}`}
          role={isAdmin ? "radio" : undefined}
          aria-checked={isAdmin ? selectedSongId === entry.songId : undefined}
          disabled={!isAdmin}
          testID={`setlist-entry-${index}`}
          onPress={() => (isAdmin ? onSelect(entry.songId) : undefined)}
          style={[styles.entryRow, selectedSongId === entry.songId ? { backgroundColor: theme.accentSoft } : null]}
        >
          <ThemedText type="small" themeColor="textSecondary" style={styles.entryIndex}>
            {index + 1}
          </ThemedText>
          <View style={rowStyles.name}>
            <ThemedText type="smallBold">{entry.title}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {[entry.key ? `Key of ${entry.key}` : null, entry.leader ? `Led by ${entry.leader}` : null, entry.needsStructure ? "needs structure" : null]
                .filter(Boolean)
                .join(" · ")}
            </ThemedText>
          </View>
        </Pressable>
      ))}
      {isAdmin && shown ? (
        <Chip
          role="button"
          label="Edit this Setlist"
          selected={false}
          testID="edit-setlist"
          onPress={() => router.push({ pathname: "/group/[groupId]/setlist/[setlistId]", params: { groupId, setlistId: shown.setlistId } })}
        />
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.two, alignItems: "center" },
  entryRow: { flexDirection: "row", alignItems: "center", gap: Spacing.three, padding: Spacing.two, borderRadius: Spacing.three },
  entryIndex: { width: 20, textAlign: "right" },
});
