import { useMutation, useQuery } from "convex/react";
import { router, useLocalSearchParams } from "expo-router";
import { Fragment, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ActionButton } from "@/components/action-button";
import { Divider } from "@/components/group/card";
import { Chip } from "@/components/group/chip";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { IconButton } from "@/components/ui/icon-button";
import { ReorderControl } from "@/components/ui/reorder-control";
import { ScreenHeader } from "@/components/ui/screen-header";
import { useDockInset } from "@/components/ui/use-dock-inset";
import { Switch } from "@/components/ui/switch";
import { Toast, useToast } from "@/components/ui/toast";
import { ControlHeight, MaxContentWidth, Radius, Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { errorText } from "@/lib/error-text";
import { InsertSectionGap } from "@/components/song/insert-section-gap";
import { insertAt, newSectionAfter } from "@/sync/new-section";
import { commonBpm, DEFAULT_BPM, markOwnTempos, withSongTempo } from "@/sync/song-tempo";
import { timeSignatureOf, type Section } from "@/sync/timeline";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";

const MIN_SAVING_MS = 400;

type EditableSection = Section & { customLabel?: string; ownTempo?: boolean };

const COMMON_TIME_SIGNATURES: readonly (readonly [number, number])[] = [
  [2, 4],
  [3, 4],
  [4, 4],
  [5, 4],
  [6, 4],
  [7, 4],
  [2, 2],
  [3, 8],
  [5, 8],
  [6, 8],
  [7, 8],
  [9, 8],
  [12, 8],
];

const beatUnitName: Record<number, string> = { 2: "half notes", 8: "eighth notes", 16: "sixteenth notes" };

function TimeSignatureField({ section, open, onToggle, testID }: { section: EditableSection; open: boolean; onToggle: () => void; testID: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.numberField, styles.timeField]}>
      <ThemedText themeColor="textSecondary" style={styles.fieldLabel}>
        Time
      </ThemedText>
      <Pressable
        role="button"
        aria-expanded={open}
        aria-label={`Time signature, ${timeSignatureOf(section)}`}
        testID={testID}
        onPress={onToggle}
        style={[styles.timeButton, { backgroundColor: theme.inputFill, borderColor: theme.inputBorder }]}
      >
        <ThemedText style={styles.timeText}>{timeSignatureOf(section)}</ThemedText>
        <Icon name="expand" size={18} color="textSecondary" />
      </Pressable>
    </View>
  );
}
type SectionRowState = { id: number; section: EditableSection };

function NumberField({ label, value, onChange, testID }: { label: string; value: number; onChange: (next: number) => void; testID: string }) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <Field
      label={label}
      testID={testID}
      value={draft ?? String(value)}
      inputMode="decimal"
      onFocus={() => setDraft(String(value))}
      onBlur={() => setDraft(null)}
      onChangeText={(next) => {
        setDraft(next);
        const parsed = Number(next);
        if (next.trim() !== "" && Number.isFinite(parsed)) onChange(parsed);
      }}
      containerStyle={styles.numberField}
      style={styles.numberInput}
      compact
      inset
    />
  );
}

function SongTempoValue({ bpm, testID }: { bpm: number; testID: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.numberField, styles.timeField]}>
      <ThemedText themeColor="textSecondary" style={styles.fieldLabel}>
        BPM
      </ThemedText>
      <View aria-label={`BPM, ${bpm}, the Song tempo`} testID={testID} style={[styles.timeButton, { borderColor: theme.inputBorder, borderStyle: "dashed" }]}>
        <ThemedText themeColor="textSecondary" style={styles.timeText}>
          {bpm}
        </ThemedText>
        <ThemedText type="caption" themeColor="textTertiary">
          Song
        </ThemedText>
      </View>
    </View>
  );
}

function SectionRow({
  section,
  songBpm,
  index,
  count,
  vocabulary,
  onChange,
  onMove,
  onDuplicate,
  onRemove,
}: {
  section: EditableSection;
  songBpm: number;
  index: number;
  count: number;
  vocabulary: readonly string[];
  onChange: (next: EditableSection) => void;
  onMove: (by: -1 | 1) => void;
  onDuplicate: () => void;
  onRemove: () => void;
}) {
  const theme = useTheme();
  const [choosing, setChoosing] = useState(false);
  const [choosingTime, setChoosingTime] = useState(false);
  const current = [section.beatsPerBar, section.beatUnit ?? 4] as const;
  const timeOptions = COMMON_TIME_SIGNATURES.some(([beats, unit]) => beats === current[0] && unit === current[1])
    ? COMMON_TIME_SIGNATURES
    : [current, ...COMMON_TIME_SIGNATURES];
  const countedUnit = beatUnitName[section.beatUnit ?? 4];
  return (
    <View style={[styles.sectionCard, { backgroundColor: theme.backgroundElement }]} testID={`section-${index}`}>
      <View style={styles.sectionTop}>
        <View style={[styles.indexBadge, { backgroundColor: theme.backgroundSelected }]}>
          <ThemedText type="smallBold" style={styles.indexText}>
            {index + 1}
          </ThemedText>
        </View>
        <Pressable
          role="button"
          aria-expanded={choosing}
          aria-label={`Section type, ${section.sectionType}`}
          testID={`section-${index}-type`}
          onPress={() => setChoosing(!choosing)}
          style={[styles.typeButton, { backgroundColor: theme.inputFill, borderColor: theme.inputBorder }]}
        >
          <ThemedText type="default" style={styles.typeText} numberOfLines={1}>
            {section.sectionType}
            {section.number ? ` ${section.number}` : ""}
          </ThemedText>
          <Icon name="expand" size={20} color="textSecondary" />
        </Pressable>
        <ReorderControl
          name={`Section ${index + 1}`}
          canMoveUp={index > 0}
          canMoveDown={index < count - 1}
          onMove={onMove}
          upTestID={`section-${index}-up`}
          downTestID={`section-${index}-down`}
        />
      </View>
      {choosing ? (
        <View style={styles.wrap}>
          {vocabulary.map((type) => (
            <Chip
              key={type}
              role="radio"
              label={type}
              selected={type === section.sectionType}
              testID={`section-${index}-type-${type}`}
              onPress={() => {
                onChange({ ...section, sectionType: type });
                setChoosing(false);
              }}
            />
          ))}
        </View>
      ) : null}
      <View style={styles.fields}>
        <NumberField label="Bars" value={section.bars} testID={`section-${index}-bars`} onChange={(bars) => onChange({ ...section, bars })} />
        <TimeSignatureField section={section} open={choosingTime} onToggle={() => setChoosingTime(!choosingTime)} testID={`section-${index}-time`} />
        {section.ownTempo ? (
          <NumberField label="BPM" value={section.bpm} testID={`section-${index}-bpm`} onChange={(bpm) => onChange({ ...section, bpm })} />
        ) : (
          <SongTempoValue bpm={songBpm} testID={`section-${index}-song-bpm`} />
        )}
      </View>
      {choosingTime ? (
        <View style={styles.wrap} role="radiogroup" aria-label="Time signature">
          {timeOptions.map(([beatsPerBar, beatUnit]) => (
            <Chip
              key={`${beatsPerBar}/${beatUnit}`}
              role="radio"
              label={`${beatsPerBar}/${beatUnit}`}
              selected={beatsPerBar === current[0] && beatUnit === current[1]}
              testID={`section-${index}-time-${beatsPerBar}-${beatUnit}`}
              onPress={() => {
                onChange({ ...section, beatsPerBar, beatUnit });
                setChoosingTime(false);
              }}
            />
          ))}
        </View>
      ) : null}
      {countedUnit ? (
        <ThemedText type="caption" themeColor="textSecondary" testID={`section-${index}-bpm-unit`}>
          BPM counts {countedUnit}, and every one gets a Click.
        </ThemedText>
      ) : null}
      <View style={styles.bottomRow}>
        <View style={styles.numberGroup}>
          <ThemedText themeColor="textSecondary" style={styles.fieldLabel}>
            Number
          </ThemedText>
          <View style={[styles.stepper, { backgroundColor: theme.inputFill, borderColor: theme.inputBorder }]} aria-label="Section number">
            <IconButton
              icon="minus"
              size={36}
              label={`Lower the number of Section ${index + 1}`}
              testID={`section-${index}-number-down`}
              onPress={() => onChange({ ...section, number: section.number && section.number > 1 ? section.number - 1 : undefined })}
            />
            <ThemedText themeColor={section.number ? "text" : "textSecondary"} style={styles.stepperValue}>
              {section.number ?? "None"}
            </ThemedText>
            <IconButton
              icon="add"
              size={36}
              label={`Raise the number of Section ${index + 1}`}
              testID={`section-${index}-number-up`}
              onPress={() => onChange({ ...section, number: Math.min(9, (section.number ?? 0) + 1) })}
            />
          </View>
        </View>
        <View style={styles.numberGroup}>
          <ThemedText themeColor="textSecondary" style={styles.fieldLabel}>
            Own tempo
          </ThemedText>
          <View style={styles.switchSlot}>
            <Switch
              bare
              label={`Own tempo for Section ${index + 1}`}
              testID={`section-${index}-own-tempo`}
              value={section.ownTempo === true}
              onChange={(on) => onChange({ ...section, ownTempo: on, bpm: songBpm })}
            />
          </View>
        </View>
        <View style={styles.numberGroup}>
          <ThemedText themeColor="textSecondary" style={styles.fieldLabel}>
            Voice cue
          </ThemedText>
          <View style={styles.switchSlot}>
            <Switch bare label="Voice cue" value={section.voiceCueEnabled !== false} onChange={(on) => onChange({ ...section, voiceCueEnabled: on })} />
          </View>
        </View>
        <View style={styles.rowActions}>
          <IconButton icon="copy" color="textTertiary" size={40} label={`Duplicate Section ${index + 1}`} onPress={onDuplicate} testID={`section-${index}-duplicate`} />
          <IconButton icon="trash" color="textTertiary" size={40} label={`Remove Section ${index + 1}`} onPress={onRemove} testID={`section-${index}-remove`} />
        </View>
      </View>
    </View>
  );
}

type LoadedSong = {
  title: string;
  key: string | null;
  tempoHint: { bpm: number; beatsPerBar: number } | null;
  bpm: number | null;
  countIn: boolean;
  sections: EditableSection[];
};

const startingBpmOf = (song: LoadedSong) => song.bpm ?? commonBpm(song.sections) ?? song.tempoHint?.bpm ?? DEFAULT_BPM;

export default function SongEditorScreen() {
  const params = useLocalSearchParams<{ groupId: string; songId: string }>();
  const songId = params.songId as Id<"songs">;
  const groupId = params.groupId as Id<"groups">;
  const song = useQuery(api.songs.get, { songId });
  const vocabulary = useQuery(api.vocabulary.list, { groupId });
  if (!song || !vocabulary) return <ThemedView style={styles.container} />;
  return <SongForm key={songId} groupId={groupId} songId={songId} song={song} vocabulary={vocabulary} />;
}

function SongForm({
  groupId,
  songId,
  song,
  vocabulary,
}: {
  groupId: Id<"groups">;
  songId: Id<"songs">;
  song: LoadedSong;
  vocabulary: readonly string[];
}) {
  const updateSong = useMutation(api.songs.updateSong);
  const deleteSong = useMutation(api.songs.deleteSong);
  const theme = useTheme();
  const dockInset = useDockInset(Spacing.three);
  const [title, setTitle] = useState(song.title);
  const [songKey, setSongKey] = useState(song.key ?? "");
  const [countIn, setCountIn] = useState(song.countIn);
  const [songBpm, setSongBpm] = useState(() => startingBpmOf(song));
  const [rows, setRows] = useState<SectionRowState[]>(() => markOwnTempos(song.sections, startingBpmOf(song)).map((section, id) => ({ id, section })));
  const [nextRowId, setNextRowId] = useState(song.sections.length);
  const sections = withSongTempo(rows.map((row) => row.section), songBpm);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deletePending, setDeletePending] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const confirmDelete = async () => {
    if (deletePending) return;
    setDeleteError(null);
    setDeletePending(true);
    try {
      await deleteSong({ songId });
      setConfirmingDelete(false);
      router.back();
    } catch (error) {
      setDeleteError(errorText(error));
    } finally {
      setDeletePending(false);
    }
  };
  const toast = useToast();

  const run = (action: () => Promise<unknown>) => {
    setMessage(null);
    action().catch((e: unknown) => setMessage(errorText(e)));
  };

  const duplicateSection = (index: number) => {
    setRows(insertAt(rows, index + 1, { id: nextRowId, section: { ...rows[index].section } }));
    setNextRowId(nextRowId + 1);
  };

  const insertSection = (at: number) => {
    setRows(insertAt(rows, at, { id: nextRowId, section: { ...newSectionAfter(sections[at - 1], song.tempoHint), bpm: songBpm, ownTempo: false } }));
    setNextRowId(nextRowId + 1);
  };

  const move = (index: number, by: -1 | 1) => {
    const target = index + by;
    if (target < 0 || target >= rows.length) return;
    const next = [...rows];
    [next[index], next[target]] = [next[target], next[index]];
    setRows(next);
  };

  const save = () =>
    run(async () => {
      setSaving(true);
      try {
        await Promise.all([updateSong({ songId, title, key: songKey, countIn, bpm: songBpm, sections }), new Promise((done) => setTimeout(done, MIN_SAVING_MS))]);
        toast.show("Song saved");
      } finally {
        setSaving(false);
      }
    });

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <ScreenHeader title="Edit Song" subtitle={song.title} onBack={() => router.back()} />
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
              <NumberField label="Song tempo (BPM)" value={songBpm} testID="song-bpm" onChange={setSongBpm} />
            </View>
            <ThemedText type="caption" themeColor="textSecondary">
              Every Section plays at the Song tempo. Turn on Own tempo in a Section to give it a different BPM.
            </ThemedText>
            <Divider />
            <Switch label="Count-in" hint="Two bars of beat numbers before the first Section, while its Voice cue is spoken" value={countIn} onChange={setCountIn} testID="count-in-toggle" />
          </View>

          <View style={styles.group}>
            <ThemedText type="label" themeColor="textSecondary" role="heading" style={styles.groupLabel}>
              Sections · {rows.length}
            </ThemedText>
            {rows.map((row, index) => (
              <Fragment key={row.id}>
                {index > 0 ? <InsertSectionGap after={index} onPress={() => insertSection(index)} /> : null}
                <SectionRow
                  section={row.section}
                  songBpm={songBpm}
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

          {message ? (
            <ThemedText type="small" themeColor="textSecondary" testID="editor-message" style={styles.centeredText}>
              {message}
            </ThemedText>
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
          <ActionButton
            large
            full
            accent
            icon="check"
            label={saving ? "Saving…" : "Save Song"}
            accessibleName="Save"
            testID="save-song"
            pending={saving}
            onPress={save}
          />
        </View>
        <ConfirmDialog
          visible={confirmingDelete}
          title={`Delete ${song.title}?`}
          message="This Song and its Sections will be deleted for everyone in the Group, and it will drop out of any Setlists. If it is playing, Playback stops."
          confirmLabel="Delete"
          pending={deletePending}
          error={deleteError}
          onConfirm={() => void confirmDelete()}
          onCancel={() => setConfirmingDelete(false)}
          testID="delete-song-dialog"
        />
        <Toast message={toast.message} bottom={dockInset + ControlHeight.large + Spacing.three * 2 + Spacing.two} />
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    gap: Spacing.four,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.five,
    maxWidth: MaxContentWidth,
    alignSelf: "center",
    width: "100%",
  },
  group: { gap: Spacing.three },
  groupLabel: { paddingHorizontal: Spacing.one },
  hint: { flexDirection: "row", alignItems: "center", gap: Spacing.two, padding: Spacing.three, borderRadius: Radius.md },
  rowActions: { flexDirection: "row", alignItems: "center", gap: Spacing.one, marginLeft: "auto", minHeight: 44 },
  bottomRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "flex-end", columnGap: Spacing.four, rowGap: Spacing.two },
  detailsCard: { gap: Spacing.three, padding: Spacing.three, borderRadius: Radius.lg },
  indexBadge: { width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center", marginRight: Spacing.one },
  indexText: { fontSize: 13, lineHeight: 16, fontVariant: ["tabular-nums"] },
  fieldLabel: { fontSize: 13, lineHeight: 18, fontWeight: 600 },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.two },
  grow: { flex: 1, minWidth: 0 },
  sectionCard: { gap: Spacing.three, padding: Spacing.three, borderRadius: Radius.lg },
  sectionTop: { flexDirection: "row", alignItems: "center", gap: Spacing.one },
  typeButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  typeText: { fontWeight: 600, fontSize: 17, flexShrink: 1 },
  stepper: { flexDirection: "row", alignItems: "center", borderRadius: 12, borderWidth: 1, paddingHorizontal: 2, minHeight: 44 },
  stepperValue: { minWidth: 44, textAlign: "center", fontSize: 16, fontWeight: 600, fontVariant: ["tabular-nums"] },
  numberGroup: { gap: Spacing.one + 2, alignItems: "flex-start" },
  switchSlot: { minHeight: 44, justifyContent: "center" },
  fields: { flexDirection: "row", gap: Spacing.two },
  numberField: { flex: 1, minWidth: 0 },
  numberInput: { fontVariant: ["tabular-nums"] },
  timeField: { gap: Spacing.one + 2 },
  timeButton: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 44, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1 },
  timeText: { fontSize: 17, fontVariant: ["tabular-nums"] },
  centeredText: { textAlign: "center" },
  dock: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: Spacing.four, paddingVertical: Spacing.three },
});
