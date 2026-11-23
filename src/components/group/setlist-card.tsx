import { useMutation, useQuery } from "convex/react";
import { router } from "expo-router";
import { memo, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";

import { Card } from "@/components/group/card";
import { Chip } from "@/components/group/chip";
import { ReorderList } from "@/components/group/reorder-list";
import { SongRow } from "@/components/group/song-row";
import { ActionButton } from "@/components/action-button";
import { ThemedText } from "@/components/themed-text";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Icon } from "@/components/ui/icon";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { errorText } from "@/lib/error-text";
import { keysWithRepeats, moveItem } from "@/lib/reorder";
import { liveOr, useStoredLibraryFor } from "@/library/use-my-library";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { wallClockNow } from "@/lib/device-clock";

const TAP_AFTER_DROP_MS = 400;
const CHANGED_ELSEWHERE = "Someone else changed this Setlist just now, so your move was not saved. This is the latest order.";

type SetlistEntry = { songId: Id<"songs">; title: string; key: string | null; leader: string | null; needsStructure: boolean };

export const SetlistCard = memo(function SetlistCard({
  groupId,
  canEdit,
  canPick,
  selectedSongId,
  onSelect,
  onReordering,
  run,
}: {
  groupId: Id<"groups">;
  canEdit: boolean;
  canPick: boolean;
  selectedSongId: Id<"songs"> | null;
  onSelect: (songId: Id<"songs">, position: number, fromCurrentSetlist: boolean) => void;
  onReordering: (reordering: boolean) => void;
  run: (action: () => Promise<unknown>) => void;
}) {
  const stored = useStoredLibraryFor(groupId);
  const setlists = liveOr(useQuery(api.setlists.list, { groupId }), () => stored?.setlists);
  const createSetlist = useMutation(api.setlists.createSetlist);
  const deleteSetlist = useMutation(api.setlists.deleteSetlist);
  const setCurrent = useMutation(api.setlists.setCurrent);
  const [makingCurrent, setMakingCurrent] = useState<Id<"setlists"> | null>(null);
  const [currentError, setCurrentError] = useState<{ setlistId: Id<"setlists">; message: string } | null>(null);
  const [deleting, setDeleting] = useState<{ setlistId: Id<"setlists">; name: string } | null>(null);
  const [deletePending, setDeletePending] = useState(false);
  const creating = useRef(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const theme = useTheme();
  const [shownId, setShownId] = useState<Id<"setlists"> | null>(null);
  const current = setlists?.find((s) => s.isCurrent) ?? null;
  const shown = setlists?.find((s) => s.setlistId === shownId) ?? current ?? setlists?.[0] ?? null;
  const liveSetlist = useQuery(api.setlists.get, shown ? { setlistId: shown.setlistId } : "skip");
  const setlist = liveOr(liveSetlist, () => (shown && stored ? stored.setlist(shown.setlistId) : undefined));
  const saveSetlist = useMutation(api.setlists.save);
  const [moved, setMoved] = useState<{ setlistId: Id<"setlists">; revision: number; entries: SetlistEntry[] } | null>(null);
  const [moveNote, setMoveNote] = useState<{ setlistId: Id<"setlists">; text: string; tone: "info" | "error" } | null>(null);
  const droppedAt = useRef(0);
  if (!setlists || (setlists.length === 0 && !canEdit)) return null;
  const savingMove = moved !== null && liveSetlist !== undefined && liveSetlist !== null && moved.setlistId === liveSetlist.setlistId && moved.revision === liveSetlist.revision;
  const entries = savingMove ? moved.entries : (setlist?.entries ?? []);
  const canReorder = canEdit && liveSetlist !== undefined && liveSetlist !== null && moved === null && entries.length > 1;
  const reorder = (from: number, to: number) => {
    if (!canReorder || !liveSetlist) return;
    const next = moveItem(liveSetlist.entries, from, to);
    const target = { setlistId: liveSetlist.setlistId, revision: liveSetlist.revision, entries: next };
    setMoveNote(null);
    setMoved(target);
    saveSetlist({
      setlistId: target.setlistId,
      revision: target.revision,
      name: liveSetlist.name,
      entries: next.map((entry) => ({ songId: entry.songId, key: entry.key ?? undefined, leader: entry.leader ?? undefined })),
    })
      .catch((error: unknown) => {
        const conflict = errorText(error).startsWith("Someone else changed this Setlist");
        setMoveNote({ setlistId: target.setlistId, text: conflict ? CHANGED_ELSEWHERE : errorText(error), tone: conflict ? "info" : "error" });
      })
      .finally(() => setMoved((current) => (current === target ? null : current)));
  };
  const rowKeys = keysWithRepeats(entries.map((entry) => entry.songId));
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
  const makeCurrent = async (setlistId: Id<"setlists">) => {
    if (makingCurrent !== null) return;
    setCurrentError(null);
    setMakingCurrent(setlistId);
    try {
      await setCurrent({ groupId, setlistId });
    } catch (error) {
      setCurrentError({ setlistId, message: errorText(error) });
    } finally {
      setMakingCurrent(null);
    }
  };
  const createAndOpen = () => {
    if (creating.current) return;
    creating.current = true;
    run(async () => {
      try {
        const setlistId = await createSetlist({ groupId, name: "New Setlist" });
        router.push({ pathname: "/group/[groupId]/setlist/[setlistId]", params: { groupId, setlistId } });
      } finally {
        creating.current = false;
      }
    });
  };
  return (
    <Card
      banner={
        allNeedSections ? (
          <View style={[styles.banner, { backgroundColor: theme.warningTint }]}>
            <Icon name="warning" size={18} color="warning" />
            <ThemedText type="small" style={[styles.bannerText, { color: theme.warningText }]}>
              Add Sections to these Songs to play them
            </ThemedText>
          </View>
        ) : null
      }
      title={shown?.isCurrent ? "Current setlist" : "Setlist"}
      heading={shown?.name}
      action={
        canEdit ? (
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
      {canEdit && shown && !shown.isCurrent ? (
        <View style={styles.makeCurrent}>
          <ActionButton
            small
            variant="secondary"
            icon="star"
            label={makingCurrent === shown.setlistId ? "Making current…" : "Make current"}
            accessibleName={`Make ${shown.name} the Current setlist`}
            testID="setlist-make-current"
            pending={makingCurrent === shown.setlistId}
            onPress={() => void makeCurrent(shown.setlistId)}
          />
          {currentError?.setlistId === shown.setlistId ? (
            <ThemedText type="caption" themeColor="danger" role="alert" testID="setlist-make-current-error">
              {currentError.message}
            </ThemedText>
          ) : null}
        </View>
      ) : null}
      {setlists.length === 0 ? (
        <ThemedText type="small" themeColor="textSecondary">
          No Setlists yet.
        </ThemedText>
      ) : setlist === undefined ? null : entries.length === 0 ? (
        <ThemedText type="small" themeColor="textSecondary">
          This Setlist is empty.
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
          <ReorderList
            items={entries.map((entry, index) => ({ ...entry, rowKey: rowKeys[index], name: entry.title }))}
            canDrag={canReorder}
            onMove={reorder}
            onStale={() => {
              if (shown) setMoveNote({ setlistId: shown.setlistId, text: CHANGED_ELSEWHERE, tone: "info" });
            }}
            onDragging={(dragging) => {
              if (!dragging) droppedAt.current = wallClockNow();
              onReordering(dragging);
            }}
            renderRow={(entry, index, handle) => (
              <SongRow
                index={index + 1}
                title={entry.title}
                meta={entry.leader ? `Led by ${entry.leader}` : null}
                songKey={entry.key}
                needsSections={!allNeedSections && entry.needsStructure}
                warningAsDot
                divider={index > 0}
                selected={selectedSongId === entry.songId}
                selectable={canPick}
                leading={handle}
                onSelect={() => {
                  if (wallClockNow() - droppedAt.current < TAP_AFTER_DROP_MS) return;
                  onSelect(entry.songId, index, shown?.isCurrent === true);
                }}
                testID={`setlist-entry-${index}`}
              />
            )}
          />
          {moveNote !== null && moveNote.setlistId === shown?.setlistId ? (
            <ThemedText
              type="caption"
              themeColor={moveNote.tone === "error" ? "danger" : "textSecondary"}
              role="alert"
              testID="setlist-move-note"
              style={styles.moveNote}
            >
              {moveNote.text}
            </ThemedText>
          ) : null}
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
});

const styles = StyleSheet.create({
  actions: { flexDirection: "row", gap: Spacing.two, marginBottom: Spacing.one },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.two, alignItems: "center" },
  makeCurrent: { alignItems: "flex-start", gap: Spacing.one },
  list: { marginHorizontal: -Spacing.two, gap: 2 },
  banner: { flexDirection: "row", alignItems: "flex-start", gap: 10, paddingHorizontal: Spacing.three, paddingVertical: 12, borderRadius: 12, marginTop: Spacing.one },
  bannerText: { flex: 1, fontWeight: 500 },
  moveNote: { paddingHorizontal: Spacing.two, paddingTop: Spacing.two },
  legend: { flexDirection: "row", alignItems: "center", gap: Spacing.two, paddingHorizontal: Spacing.two, paddingBottom: Spacing.one },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
});
