import { useMutation, useQuery } from "convex/react";
import { router } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { Card } from "@/components/group/card";
import { Chip } from "@/components/group/chip";
import { SongRow } from "@/components/group/song-row";
import { ActionButton } from "@/components/action-button";
import { ThemedText } from "@/components/themed-text";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Icon } from "@/components/ui/icon";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { errorText } from "@/lib/error-text";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

export function SetlistCard({
  groupId,
  isAdmin,
  canPick,
  selectedSongId,
  onSelect,
  run,
}: {
  groupId: Id<"groups">;
  isAdmin: boolean;
  canPick: boolean;
  selectedSongId: Id<"songs"> | null;
  onSelect: (songId: Id<"songs">, position: number, fromCurrentSetlist: boolean) => void;
  run: (action: () => Promise<unknown>) => void;
}) {
  const setlists = useQuery(api.setlists.list, { groupId });
  const createSetlist = useMutation(api.setlists.createSetlist);
  const deleteSetlist = useMutation(api.setlists.deleteSetlist);
  const [deleting, setDeleting] = useState<{ setlistId: Id<"setlists">; name: string } | null>(null);
  const [deletePending, setDeletePending] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const theme = useTheme();
  const [shownId, setShownId] = useState<Id<"setlists"> | null>(null);
  const current = setlists?.find((s) => s.isCurrent) ?? null;
  const shown = setlists?.find((s) => s.setlistId === shownId) ?? current ?? setlists?.[0] ?? null;
  const setlist = useQuery(api.setlists.get, shown ? { setlistId: shown.setlistId } : "skip");
  if (!setlists || (setlists.length === 0 && !isAdmin)) return null;
  const entries = setlist?.entries ?? [];
  const allNeedSections = entries.length > 0 && entries.every((entry) => entry.needsStructure);
  const someNeedSections = entries.some((entry) => entry.needsStructure);
  const confirmDelete = async () => {
    const target = deleting;
    if (!target || deletePending) return;
    setDeleteError(null);
    setDeletePending(true);
    try {
      await deleteSetlist({ setlistId: target.setlistId });
      setShownId(null);
      setDeleting((current) => (current === target ? null : current));
    } catch (error) {
      setDeleteError(errorText(error));
    } finally {
      setDeletePending(false);
    }
  };
  const createAndOpen = () =>
    run(async () => {
      const setlistId = await createSetlist({ groupId, name: "New Setlist" });
      router.push({ pathname: "/group/[groupId]/setlist/[setlistId]", params: { groupId, setlistId } });
    });
  return (
    <Card
      banner={
        allNeedSections ? (
          <View style={[styles.banner, { backgroundColor: theme.warningTint }]}>
            <Icon name="warning" size={18} color="warning" />
            <ThemedText type="small" style={[styles.bannerText, { color: theme.warningText }]}>
              None of these Songs have Sections yet, so none can start. Add them in the Song library.
            </ThemedText>
          </View>
        ) : null
      }
      title={shown?.isCurrent ? "Current setlist" : "Setlist"}
      heading={shown?.name}
      action={
        isAdmin ? (
          <View style={styles.actions}>
            {shown ? (
              <ActionButton
                small
                variant="pill"
                icon="edit"
                label="Edit"
                accessibleName="Edit this Setlist"
                testID="edit-setlist"
                onPress={() => router.push({ pathname: "/group/[groupId]/setlist/[setlistId]", params: { groupId, setlistId: shown.setlistId } })}
              />
            ) : null}
            <ActionButton small variant="pill" icon="add" label="New" accessibleName="New Setlist" testID="new-setlist" onPress={createAndOpen} />
            {shown ? (
              <ActionButton
                small
                variant="pill"
                icon="trash"
                label="Delete"
                accessibleName="Delete this Setlist"
                testID="delete-shown-setlist"
                onPress={() => {
                  setDeleteError(null);
                  setDeleting({ setlistId: shown.setlistId, name: shown.name });
                }}
              />
            ) : null}
          </View>
        ) : null
      }
    >
      {setlists.length > 1 ? (
        <View style={styles.wrap} role="radiogroup" aria-label="Setlists">
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
      ) : setlist === undefined ? null : entries.length === 0 ? (
        <ThemedText type="small" themeColor="textSecondary">
          This Setlist is empty. Tap Edit to add Songs.
        </ThemedText>
      ) : (
        <View style={styles.list}>
          {!allNeedSections && someNeedSections ? (
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
              needsSections={!allNeedSections && entry.needsStructure}
              warningAsDot
              divider={index > 0}
              selected={selectedSongId === entry.songId}
              selectable={canPick}
              onSelect={() => onSelect(entry.songId, index, shown?.isCurrent === true)}
              testID={`setlist-entry-${index}`}
            />
          ))}
        </View>
      )}
      <ConfirmDialog
        visible={deleting !== null}
        title={`Delete ${deleting?.name ?? ""}?`}
        message="This Setlist will be deleted for everyone in the Group. Its Songs stay in the Song library."
        confirmLabel="Delete"
        pending={deletePending}
        error={deleteError}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setDeleting(null)}
        testID="delete-setlist-dialog"
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: "row", gap: Spacing.two, marginBottom: Spacing.one },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.two, alignItems: "center" },
  list: { marginHorizontal: -Spacing.two, gap: 2 },
  banner: { flexDirection: "row", alignItems: "flex-start", gap: 10, paddingHorizontal: Spacing.three, paddingVertical: 12, borderRadius: 12, marginTop: Spacing.one },
  bannerText: { flex: 1, fontWeight: 500 },
  legend: { flexDirection: "row", alignItems: "center", gap: Spacing.two, paddingHorizontal: Spacing.two, paddingBottom: Spacing.one },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
});
