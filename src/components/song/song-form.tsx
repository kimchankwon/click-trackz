import { useMutation, useQuery } from "convex/react";
import { router, usePreventRemove } from "expo-router";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ActionButton } from "@/components/action-button";
import { Divider } from "@/components/group/card";
import { Chip } from "@/components/group/chip";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { ScreenHeader } from "@/components/ui/screen-header";
import { PinnedHeader, PINNED_CONTENT_TOP, usePinnedHeader } from "@/components/ui/pinned-header";
import { Segmented } from "@/components/ui/segmented";
import { useDockInset } from "@/components/ui/use-dock-inset";
import { Switch } from "@/components/ui/switch";
import { Toast, useToast } from "@/components/ui/toast";
import { ControlHeight, MaxContentWidth, Radius, Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { backOr } from "@/lib/back-or";
import { copyBaseOf, copyTitle } from "@/lib/copy-title";
import { saveThen } from "@/lib/save-then";
import { errorText } from "@/lib/error-text";
import { useHoldRestart } from "@/lib/restart-hold";
import { canEditSongs } from "@/lib/roles";
import { draftProblem, sameDraft, type SongDraft } from "@/lib/song-draft";
import { InsertSectionGap } from "@/components/song/insert-section-gap";
import { TapTempoButton } from "@/components/song/tap-tempo-button";
import { NumberField, SectionRow, TimeSignatureField, type EditableSection, type SectionRowState } from "@/components/song/section-row";
import { insertAt, newSectionAfter } from "@/sync/new-section";
import { commonBpm, DEFAULT_BPM, markOwnTempos, withSongTempo } from "@/sync/song-tempo";
import { markOwnTimes, startingSongTime, withSongTime, type SongTimeSignature } from "@/sync/song-time";
import { CUE_LEAD_BARS, SUBDIVISIONS } from "@/sync/timeline";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

const MIN_SAVING_MS = 400;

type LoadedSong = {
  title: string;
  key: string | null;
  tempoHint: { bpm: number; beatsPerBar: number } | null;
  bpm: number | null;
  timeSignature?: SongTimeSignature | null;
  countIn: boolean;
  subdivision: number;
  cueLeadBars: number;
  copyBase: string | null;
  sections: EditableSection[];
};

const startingBpmOf = (song: LoadedSong) => song.bpm ?? commonBpm(song.sections) ?? song.tempoHint?.bpm ?? DEFAULT_BPM;

function savedDraftOf(song: LoadedSong): SongDraft {
  const bpm = startingBpmOf(song);
  return {
    title: song.title,
    key: song.key ?? "",
    countIn: song.countIn,
    subdivision: song.subdivision,
    cueLeadBars: song.cueLeadBars,
    bpm,
    timeSignature: startingSongTime(song),
    sections: withSongTime(markOwnTimes(withSongTempo(markOwnTempos(song.sections, bpm), bpm), startingSongTime(song)), startingSongTime(song)),
  };
}

const SONG_COPY_DETAILS = "with the same Key, tempo, cues and Sections";

export function SongForm({
  groupId,
  songId,
  song,
  vocabulary,
  onDeleting,
}: {
  groupId: Id<"groups">;
  songId: Id<"songs">;
  song: LoadedSong;
  vocabulary: readonly string[];
  onDeleting: (deleting: boolean) => void;
}) {
  const toGroup = () => backOr({ pathname: "/group/[groupId]", params: { groupId } });
  const updateSong = useMutation(api.songs.updateSong);
  const deleteSong = useMutation(api.songs.deleteSong);
  const duplicateSong = useMutation(api.songs.duplicateSong);
  const library = useQuery(api.songs.list, { groupId });
  const myGroups = useQuery(api.groups.myGroups, {});
  const copyToGroup = useMutation(api.songs.copyToGroup);
  const copyTargets = (myGroups ?? []).filter((other) => other.groupId !== groupId && canEditSongs(other.role) && !other.locked);
  const copyLabel = copyTargets.every((target) => target.offline)
    ? "Copy to My Library"
    : copyTargets.some((target) => target.offline)
      ? "Copy Song to…"
      : "Copy to another Group";
  const [copyOpen, setCopyOpen] = useState(false);
  const [copyTarget, setCopyTarget] = useState<Id<"groups"> | null>(null);
  const [copyPending, setCopyPending] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);
  const theme = useTheme();
  const dockInset = useDockInset(Spacing.three);
  const pinned = usePinnedHeader();
  const [title, setTitle] = useState(song.title);
  const [songKey, setSongKey] = useState(song.key ?? "");
  const [countIn, setCountIn] = useState(song.countIn);
  const [subdivision, setSubdivision] = useState(song.subdivision);
  const [cueLeadBars, setCueLeadBars] = useState(song.cueLeadBars);
  const [songBpm, setSongBpm] = useState(() => startingBpmOf(song));
  const [songTime, setSongTime] = useState<SongTimeSignature>(() => startingSongTime(song));
  const [rows, setRows] = useState<SectionRowState[]>(() =>
    markOwnTimes(markOwnTempos(song.sections, startingBpmOf(song)), startingSongTime(song)).map((section, id) => ({ id, section })),
  );
  const [nextRowId, setNextRowId] = useState(song.sections.length);
  const sections = useMemo(
    () => withSongTime(withSongTempo(rows.map((row) => (row.section.number === undefined ? { ...row.section, letter: undefined } : row.section)), songBpm), songTime),
    [rows, songBpm, songTime],
  );
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deletePending, setDeletePending] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const draft = { title, key: songKey, countIn, subdivision, cueLeadBars, bpm: songBpm, timeSignature: songTime, sections };
  const changed = !sameDraft(draft, savedDraftOf(song));
  useHoldRestart(changed);
  const problem = draftProblem(draft);
  const [loadedFrom, setLoadedFrom] = useState(song);
  if (song !== loadedFrom) {
    const loaded = savedDraftOf(loadedFrom);
    if (!sameDraft(savedDraftOf(song), loaded) && sameDraft(draft, loaded)) {
      const bpm = startingBpmOf(song);
      const time = startingSongTime(song);
      setTitle(song.title);
      setSongKey(song.key ?? "");
      setCountIn(song.countIn);
      setSubdivision(song.subdivision);
      setCueLeadBars(song.cueLeadBars);
      setSongBpm(bpm);
      setSongTime(time);
      setRows(markOwnTimes(markOwnTempos(song.sections, bpm), time).map((section, at) => ({ id: nextRowId + at, section })));
      setNextRowId(nextRowId + song.sections.length);
    }
    setLoadedFrom(song);
  }
  const [confirmingDuplicate, setConfirmingDuplicate] = useState(false);
  const [offeredCopyName, setOfferedCopyName] = useState<string | null>(null);
  const [duplicatePending, setDuplicatePending] = useState(false);
  const [duplicateError, setDuplicateError] = useState<string | null>(null);
  const toast = useToast();
  const [askDiscard, setAskDiscard] = useState(false);
  const [departure, setDeparture] = useState<(() => void) | null>(null);
  const [leavePending, setLeavePending] = useState(false);
  const [leaveError, setLeaveError] = useState<string | null>(null);
  const attempt = useRef(0);
  const beginAttempt = () => ++attempt.current;
  const abandonAttempt = () => {
    attempt.current += 1;
  };
  usePreventRemove(changed && departure === null, () => setAskDiscard(true));
  useEffect(() => {
    departure?.();
  }, [departure]);
  const copyName = library
    ? copyTitle(
        copyBaseOf({ title, copyBase: song.copyBase }),
        library.map((other) => (other.songId === songId ? title : other.title)),
      )
    : null;
  const confirmDuplicate = async () => {
    if (duplicatePending) return;
    if (changed && problem !== null) {
      setDuplicateError(problem);
      return;
    }
    setDuplicateError(null);
    setDuplicatePending(true);
    const mine = beginAttempt();
    try {
      const copy = await saveThen(changed ? () => updateSong({ songId, ...draft }) : null, () => duplicateSong({ songId }), () => mine === attempt.current).finally(() => setDuplicatePending(false));
      if (copy === null || mine !== attempt.current) return;
      setConfirmingDuplicate(false);
      setDeparture(() => () => router.replace({ pathname: "/group/[groupId]/song/[songId]", params: { groupId, songId: copy.songId } }));
    } catch (error) {
      if (mine !== attempt.current) toast.show(errorText(error), "error");
      else setDuplicateError(errorText(error));
    }
  };
  const confirmCopy = async () => {
    if (copyPending) return;
    if (copyTarget === null) {
      setCopyError("Pick a Group to copy it to");
      return;
    }
    if (changed && problem !== null) {
      setCopyError(problem);
      return;
    }
    setCopyError(null);
    setCopyPending(true);
    const mine = beginAttempt();
    try {
      const copy = await saveThen(changed ? () => updateSong({ songId, ...draft }) : null, () => copyToGroup({ songId, toGroupId: copyTarget }), () => mine === attempt.current).finally(() => setCopyPending(false));
      if (copy === null) return;
      toast.show(`${copy.title} is now in ${copy.groupName}`);
      if (mine === attempt.current) setCopyOpen(false);
    } catch (error) {
      if (mine !== attempt.current) toast.show(errorText(error), "error");
      else setCopyError(errorText(error));
    }
  };
  const confirmDelete = async () => {
    if (deletePending) return;
    setDeleteError(null);
    setDeletePending(true);
    const mine = beginAttempt();
    onDeleting(true);
    try {
      await deleteSong({ songId }).finally(() => setDeletePending(false));
      if (mine !== attempt.current) return;
      setConfirmingDelete(false);
      setDeparture(() => toGroup);
    } catch (error) {
      onDeleting(false);
      if (mine !== attempt.current) toast.show(errorText(error), "error");
      else setDeleteError(errorText(error));
    }
  };

  const run = (action: () => Promise<unknown>) => {
    setMessage(null);
    action().catch((e: unknown) => setMessage(errorText(e)));
  };

  const duplicateSection = (index: number) => {
    setRows(insertAt(rows, index + 1, { id: nextRowId, section: { ...rows[index].section } }));
    setNextRowId(nextRowId + 1);
  };

  const insertSection = (at: number) => {
    const previous = at > 0 ? rows[at - 1].section : undefined;
    const tempo = previous?.ownTempo === true ? { bpm: previous.bpm, ownTempo: true } : { bpm: songBpm, ownTempo: false };
    const time = previous?.ownTime === true ? { beatsPerBar: previous.beatsPerBar, beatUnit: previous.beatUnit, ownTime: true } : { ...songTime, ownTime: false };
    setRows(insertAt(rows, at, { id: nextRowId, section: { ...newSectionAfter(sections[at - 1], song.tempoHint), ...tempo, ...time } }));
    setNextRowId(nextRowId + 1);
  };

  const move = (index: number, by: -1 | 1) => {
    const target = index + by;
    if (target < 0 || target >= rows.length) return;
    const next = [...rows];
    [next[index], next[target]] = [next[target], next[index]];
    setRows(next);
  };

  const saveAndLeave = async () => {
    if (leavePending || problem) return;
    setLeaveError(null);
    setLeavePending(true);
    const mine = beginAttempt();
    try {
      await updateSong({ songId, ...draft }).finally(() => setLeavePending(false));
      if (mine !== attempt.current) {
        toast.show("Song saved");
        return;
      }
      setDeparture(() => toGroup);
    } catch (error) {
      if (mine !== attempt.current) toast.show(errorText(error), "error");
      else setLeaveError(errorText(error));
    }
  };

  const save = () =>
    run(async () => {
      setSaving(true);
      await Promise.all([updateSong({ songId, ...draft }), new Promise((done) => setTimeout(done, MIN_SAVING_MS))]).finally(() => setSaving(false));
      toast.show("Song saved");
    });

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
        <PinnedHeader scrolled={pinned.scrolled}>
          <ScreenHeader title="Edit Song" subtitle={song.title} onBack={toGroup} />
        </PinnedHeader>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets {...pinned.scrollProps}>
          {song.tempoHint && sections.length === 0 ? (
            <View style={[styles.hint, { backgroundColor: theme.accentTint }]}>
              <Icon name="speed" size={20} color="accent" />
              <ThemedText type="small" testID="tempo-hint" style={styles.grow}>
                Suggested tempo {song.tempoHint.bpm} BPM, {song.tempoHint.beatsPerBar} beats per bar
              </ThemedText>
            </View>
          ) : null}
          <View style={[styles.detailsCard, { backgroundColor: theme.backgroundElement }]}>
            <Field label="Title" testID="song-title-input" value={title} onChangeText={setTitle} placeholder="Song title" />
            <View style={styles.fields}>
              <Field label="Key" testID="song-key-input" value={songKey} onChangeText={setSongKey} placeholder="e.g. D" containerStyle={styles.numberField} />
              <NumberField label="BPM" value={songBpm} testID="song-bpm" onChange={setSongBpm} />
              <TimeSignatureField section={songTime} testID="song-time" onChange={(time) => setSongTime({ beatsPerBar: time.beatsPerBar, beatUnit: time.beatUnit ?? 4 })} />
            </View>
            <TapTempoButton testID="tap-tempo" onTempo={setSongBpm} />
            <Divider />
            <View style={styles.settingRow}>
              <ThemedText type="smallBold" style={styles.grow}>
                Count-in
              </ThemedText>
              <Switch bare label="Count-in" value={countIn} onChange={setCountIn} testID="count-in-toggle" />
            </View>
            <Divider />
            <View style={styles.subdivision}>
              <ThemedText type="smallBold">Voice cues start</ThemedText>
              <Segmented
                label="Voice cues start"
                testID="cue-lead"
                value={String(cueLeadBars)}
                onChange={(next) => setCueLeadBars(Number(next))}
                options={CUE_LEAD_BARS.map((bars) => ({ value: String(bars), label: bars === 1 ? "1 bar before" : "2 bars before" }))}
              />
            </View>
            <Divider />
            <View style={styles.subdivision}>
              <ThemedText type="smallBold">Clicks per beat</ThemedText>
              <Segmented
                label="Clicks per beat"
                testID="subdivision"
                value={String(subdivision)}
                onChange={(next) => setSubdivision(Number(next))}
                options={SUBDIVISIONS.map((n) => ({ value: String(n), label: String(n) }))}
              />
            </View>
          </View>

          <View style={styles.group}>
            <ThemedText type="label" themeColor="textSecondary" role="heading" style={styles.groupLabel}>
              Sections ({rows.length})
            </ThemedText>
            {rows.map((row, index) => (
              <Fragment key={row.id}>
                {index > 0 ? <InsertSectionGap after={index} onPress={() => insertSection(index)} /> : null}
                <SectionRow
                  section={row.section}
                  songBpm={songBpm}
                  songTime={songTime}
                  index={index}
                  count={rows.length}
                  vocabulary={vocabulary}
                  onChange={(next) => setRows(rows.map((r) => (r.id === row.id ? { id: r.id, section: next } : r)))}
                  onMove={(by) => move(index, by)}
                  onDuplicate={() => duplicateSection(index)}
                  onRemove={() => setRows(rows.filter((r) => r.id !== row.id))}
                />
              </Fragment>
            ))}
            <ActionButton icon="add" label="Add Section" testID="add-section" onPress={() => insertSection(rows.length)} />
          </View>

          <ActionButton
            icon="copy"
            label="Duplicate Song"
            testID="duplicate-song"
            onPress={() => {
              setDuplicateError(null);
              setOfferedCopyName(copyName);
              setConfirmingDuplicate(true);
            }}
          />
          {copyTargets.length > 0 ? (
            <ActionButton
              icon="share"
              label={copyLabel}
              testID="copy-song-to-group"
              onPress={() => {
                setCopyError(null);
                setCopyTarget(copyTargets.length === 1 ? copyTargets[0].groupId : null);
                setCopyOpen(true);
              }}
            />
          ) : null}
          <ActionButton
            variant="danger"
            icon="trash"
            label="Delete Song"
            testID="delete-song"
            onPress={() => {
              setDeleteError(null);
              setConfirmingDelete(true);
            }}
          />
        </ScrollView>
        <View style={[styles.dock, { backgroundColor: theme.background, borderTopColor: theme.border, paddingBottom: dockInset }]}>
          {problem ?? message ? (
            <ThemedText type="small" themeColor={problem ? "danger" : "textSecondary"} testID="editor-message" style={styles.centeredText}>
              {problem ?? message}
            </ThemedText>
          ) : null}
          <ActionButton
            large
            full
            accent
            icon="check"
            label={saving ? "Saving…" : "Save Song"}
            accessibleName="Save"
            testID="save-song"
            pending={saving}
            disabled={problem !== null || !changed}
            onPress={save}
          />
        </View>
        <ConfirmDialog
          visible={confirmingDuplicate}
          title={`Duplicate ${song.title}?`}
          message={
            changed
              ? `Your changes are saved to ${song.title} first. Then ${offeredCopyName ?? "a copy"} is added to the Song library ${SONG_COPY_DETAILS}.`
              : `${offeredCopyName ?? "A copy"} is added to the Song library ${SONG_COPY_DETAILS}.`
          }
          confirmLabel={changed ? "Save and duplicate" : "Duplicate"}
          pending={duplicatePending}
          error={duplicateError}
          onConfirm={() => void confirmDuplicate()}
          onCancel={() => {
            abandonAttempt();
            setConfirmingDuplicate(false);
          }}
          testID="duplicate-song-dialog"
        />
        <ConfirmDialog
          visible={copyOpen}
          title={`Copy ${song.title}?`}
          message={
            changed
              ? `Your changes are saved to ${song.title} first. Then a copy goes where you pick ${SONG_COPY_DETAILS}.`
              : `A copy goes where you pick ${SONG_COPY_DETAILS}.`
          }
          confirmLabel={changed ? "Save and copy" : "Copy"}
          pending={copyPending}
          error={copyError}
          onConfirm={() => void confirmCopy()}
          onCancel={() => {
            abandonAttempt();
            setCopyOpen(false);
          }}
          testID="copy-song-dialog"
        >
          <ScrollView style={styles.copyScroll} contentContainerStyle={styles.copyTargets} role="radiogroup" aria-label="Group to copy to">
            {copyTargets.map((target) => (
              <Chip
                key={target.groupId}
                role="radio"
                selected={copyTarget === target.groupId}
                icon={target.offline ? "library" : "group"}
                label={target.name}
                testID={`copy-target-${target.name}`}
                disabled={copyPending}
                onPress={() => setCopyTarget(target.groupId)}
              />
            ))}
          </ScrollView>
        </ConfirmDialog>
        <ConfirmDialog
          visible={askDiscard && departure === null}
          title="Save changes?"
          message={`Your edits to ${song.title} are not saved.`}
          confirmLabel="Save"
          cancelLabel="Discard"
          pending={leavePending}
          error={leaveError ?? problem}
          onConfirm={() => void saveAndLeave()}
          onCancel={() => {
            if (!leavePending) setDeparture(() => toGroup);
          }}
          onDismiss={() => {
            abandonAttempt();
            setLeaveError(null);
            setAskDiscard(false);
          }}
          testID="discard-song-dialog"
        />
        <ConfirmDialog
          visible={confirmingDelete}
          title={`Delete ${song.title}?`}
          message="This Song and its Sections will be deleted for everyone in the Group, and it will drop out of any Setlists. If it is playing, Playback stops."
          confirmLabel="Delete"
          pending={deletePending}
          error={deleteError}
          onConfirm={() => void confirmDelete()}
          onCancel={() => {
            abandonAttempt();
            setConfirmingDelete(false);
          }}
          testID="delete-song-dialog"
        />
        <Toast message={toast.message} bottom={dockInset + ControlHeight.large + Spacing.three * 2 + Spacing.two} />
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  copyScroll: { maxHeight: 220, flexGrow: 0, flexShrink: 1 },
  copyTargets: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.two },
  container: { flex: 1 },
  subdivision: { gap: Spacing.two },
  settingRow: { flexDirection: "row", alignItems: "center", gap: Spacing.two },
  content: {
    gap: Spacing.four,
    paddingHorizontal: Spacing.four,
    paddingTop: PINNED_CONTENT_TOP,
    paddingBottom: Spacing.five,
    maxWidth: MaxContentWidth,
    alignSelf: "center",
    width: "100%",
  },
  group: { gap: Spacing.three },
  groupLabel: { paddingHorizontal: Spacing.one },
  hint: { flexDirection: "row", alignItems: "center", gap: Spacing.two, padding: Spacing.three, borderRadius: Radius.md },
  detailsCard: { gap: Spacing.three, padding: Spacing.three, borderRadius: Radius.lg },
  grow: { flex: 1, minWidth: 0 },
  fields: { flexDirection: "row", gap: Spacing.two },
  numberField: { flex: 1, minWidth: 0 },
  centeredText: { textAlign: "center" },
  dock: { gap: Spacing.two, borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: Spacing.four, paddingVertical: Spacing.three },
});
