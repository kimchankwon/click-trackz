import { useMutation, useQuery } from "convex/react";
import { router, useLocalSearchParams, usePreventRemove } from "expo-router";
import { Fragment, useEffect, useRef, useState } from "react";
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
import { PinnedHeader, PINNED_CONTENT_TOP, usePinnedHeader } from "@/components/ui/pinned-header";
import { Segmented } from "@/components/ui/segmented";
import { useDockInset } from "@/components/ui/use-dock-inset";
import { Switch } from "@/components/ui/switch";
import { Toast, useToast } from "@/components/ui/toast";
import { ControlHeight, MaxContentWidth, Radius, Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { copyBaseOf, copyTitle } from "@/lib/copy-title";
import { errorText } from "@/lib/error-text";
import { draftProblem, sameDraft, type SongDraft } from "@/lib/song-draft";
import { InsertSectionGap } from "@/components/song/insert-section-gap";
import { TapTempoButton } from "@/components/song/tap-tempo-button";
import { insertAt, newSectionAfter } from "@/sync/new-section";
import { commonBpm, DEFAULT_BPM, markOwnTempos, withSongTempo } from "@/sync/song-tempo";
import { cuePattern } from "@/sync/cue-pattern";
import { newTimeChange } from "@/sync/time-changes";
import { CUE_LEAD_BARS, MAX_PLAYS, playsOf, SUBDIVISIONS, timeSignatureOf, type Section, type TimeChange } from "@/sync/timeline";
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

function withPlays(section: EditableSection, plays: number): EditableSection {
  const next = Math.min(MAX_PLAYS, Math.max(1, plays));
  return { ...section, plays: next > 1 ? next : undefined };
}

type TimeSignature = Pick<Section, "beatsPerBar" | "beatUnit">;

function TimeSignatureChips({ current, testID, onPick }: { current: TimeSignature; testID: string; onPick: (beatsPerBar: number, beatUnit: number) => void }) {
  const picked = [current.beatsPerBar, current.beatUnit ?? 4] as const;
  const options = COMMON_TIME_SIGNATURES.some(([beats, unit]) => beats === picked[0] && unit === picked[1]) ? COMMON_TIME_SIGNATURES : [picked, ...COMMON_TIME_SIGNATURES];
  return (
    <View style={styles.wrap} role="radiogroup" aria-label="Time signature">
      {options.map(([beatsPerBar, beatUnit]) => (
        <Chip
          key={`${beatsPerBar}/${beatUnit}`}
          role="radio"
          label={`${beatsPerBar}/${beatUnit}`}
          selected={beatsPerBar === picked[0] && beatUnit === picked[1]}
          testID={`${testID}-${beatsPerBar}-${beatUnit}`}
          onPress={() => onPick(beatsPerBar, beatUnit)}
        />
      ))}
    </View>
  );
}

function TimeChangeRow({ change, testID, onChange, onRemove }: { change: TimeChange; testID: string; onChange: (next: TimeChange) => void; onRemove: () => void }) {
  const theme = useTheme();
  const [choosingTime, setChoosingTime] = useState(false);
  return (
    <View style={[styles.changeRow, { backgroundColor: theme.background }]} testID={testID}>
      <View style={styles.fields}>
        <NumberField label="From bar" integer value={change.bar} testID={`${testID}-bar`} onChange={(bar) => onChange({ ...change, bar })} />
        <NumberField label="Bars" integer value={change.bars} testID={`${testID}-bars`} onChange={(bars) => onChange({ ...change, bars })} />
        <TimeSignatureField section={change} open={choosingTime} onToggle={() => setChoosingTime(!choosingTime)} testID={`${testID}-time`} />
        <View style={styles.changeRemove}>
          <IconButton icon="trash" color="textTertiary" size={40} label={`Remove the time change at bar ${change.bar}`} onPress={onRemove} testID={`${testID}-remove`} />
        </View>
      </View>
      {choosingTime ? (
        <TimeSignatureChips
          current={change}
          testID={`${testID}-time`}
          onPick={(beatsPerBar, beatUnit) => {
            onChange({ ...change, beatsPerBar, beatUnit });
            setChoosingTime(false);
          }}
        />
      ) : null}
    </View>
  );
}

function TimeChangesField({ section, index, onChange }: { section: EditableSection; index: number; onChange: (next: EditableSection) => void }) {
  const changes = section.timeChanges ?? [];
  const added = newTimeChange(section);
  const update = (timeChanges: TimeChange[]) => onChange({ ...section, timeChanges: timeChanges.length > 0 ? timeChanges : undefined });
  return (
    <View style={styles.changes}>
      {changes.map((change, changeIndex) => (
        <TimeChangeRow
          key={changeIndex}
          change={change}
          testID={`section-${index}-change-${changeIndex}`}
          onChange={(edited) => update(changes.map((other, otherIndex) => (otherIndex === changeIndex ? edited : other)))}
          onRemove={() => update(changes.filter((_, otherIndex) => otherIndex !== changeIndex))}
        />
      ))}
      {added ? (
        <Pressable
          role="button"
          aria-label={`Add a time change to Section ${index + 1}`}
          testID={`section-${index}-add-change`}
          onPress={() => update([...changes, added])}
          style={({ pressed }) => [styles.addChange, pressed ? styles.addChangePressed : null]}
        >
          <Icon name="add" size={18} color="accent" />
          <ThemedText themeColor="accent" style={styles.addChangeText}>
            Add time change
          </ThemedText>
        </Pressable>
      ) : null}
    </View>
  );
}

function TimeSignatureField({ section, open, onToggle, testID }: { section: TimeSignature; open: boolean; onToggle: () => void; testID: string }) {
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
function StepperField({
  label,
  value,
  muted,
  lowerLabel,
  raiseLabel,
  testID,
  onLower,
  onRaise,
}: {
  label: string;
  value: string;
  muted: boolean;
  lowerLabel: string;
  raiseLabel: string;
  testID: string;
  onLower: () => void;
  onRaise: () => void;
}) {
  const theme = useTheme();
  return (
    <View style={styles.numberGroup}>
      <ThemedText themeColor="textSecondary" style={styles.fieldLabel}>
        {label}
      </ThemedText>
      <View style={[styles.stepper, { backgroundColor: theme.inputFill, borderColor: theme.inputBorder }]} aria-label={label}>
        <IconButton icon="minus" size={36} label={lowerLabel} testID={`${testID}-down`} onPress={onLower} />
        <ThemedText themeColor={muted ? "textSecondary" : "text"} style={styles.stepperValue} testID={`${testID}-value`}>
          {value}
        </ThemedText>
        <IconButton icon="add" size={36} label={raiseLabel} testID={`${testID}-up`} onPress={onRaise} />
      </View>
    </View>
  );
}

function PlaysBadge({ plays, testID }: { plays: number; testID: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.playsBadge, { backgroundColor: theme.accentTint }]} testID={testID} aria-label={`Plays ${plays} times`}>
      <Icon name="plays" size={15} color="accent" />
      <ThemedText themeColor="accent" style={styles.playsBadgeText}>
        {`×${plays}`}
      </ThemedText>
    </View>
  );
}

type SectionRowState = { id: number; section: EditableSection };

function NumberField({ label, value, onChange, testID, integer = false }: { label: string; value: number; onChange: (next: number) => void; testID: string; integer?: boolean }) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <Field
      label={label}
      testID={testID}
      value={draft ?? String(value)}
      inputMode={integer ? "numeric" : "decimal"}
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
  const countedUnit = beatUnitName[section.beatUnit ?? 4];
  const plays = playsOf(section);
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
        {plays > 1 ? <PlaysBadge plays={plays} testID={`section-${index}-plays-badge`} /> : null}
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
        <NumberField label="Bars" integer value={section.bars} testID={`section-${index}-bars`} onChange={(bars) => onChange({ ...section, bars })} />
        <TimeSignatureField section={section} open={choosingTime} onToggle={() => setChoosingTime(!choosingTime)} testID={`section-${index}-time`} />
        {section.ownTempo ? (
          <NumberField label="BPM" value={section.bpm} testID={`section-${index}-bpm`} onChange={(bpm) => onChange({ ...section, bpm })} />
        ) : (
          <SongTempoValue bpm={songBpm} testID={`section-${index}-song-bpm`} />
        )}
      </View>
      {choosingTime ? (
        <TimeSignatureChips
          current={section}
          testID={`section-${index}-time`}
          onPick={(beatsPerBar, beatUnit) => {
            onChange({ ...section, beatsPerBar, beatUnit });
            setChoosingTime(false);
          }}
        />
      ) : null}
      {countedUnit ? (
        <ThemedText type="caption" themeColor="textSecondary" testID={`section-${index}-bpm-unit`}>
          BPM counts {countedUnit}, and every one gets a Click.
        </ThemedText>
      ) : null}
      <TimeChangesField section={section} index={index} onChange={onChange} />
      <View style={styles.bottomRow}>
        <StepperField
          label="Number"
          value={section.number ? String(section.number) : "None"}
          muted={!section.number}
          lowerLabel={`Lower the number of Section ${index + 1}`}
          raiseLabel={`Raise the number of Section ${index + 1}`}
          testID={`section-${index}-number`}
          onLower={() => onChange({ ...section, number: section.number && section.number > 1 ? section.number - 1 : undefined })}
          onRaise={() => onChange({ ...section, number: Math.min(9, (section.number ?? 0) + 1) })}
        />
        <StepperField
          label="Plays"
          value={`×${plays}`}
          muted={plays === 1}
          lowerLabel={`Play Section ${index + 1} one time fewer`}
          raiseLabel={`Play Section ${index + 1} one more time`}
          testID={`section-${index}-plays`}
          onLower={() => onChange(withPlays(section, plays - 1))}
          onRaise={() => onChange(withPlays(section, plays + 1))}
        />
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
  subdivision: number;
  cueLeadBars: number;
  copyBase: string | null;
  sections: EditableSection[];
};

const subdivisionPattern = (beatsPerBar: number, subdivision: number) =>
  subdivision === 1
    ? "One Click on each beat."
    : `Each bar clicks ${Array.from({ length: beatsPerBar }, (_, beat) => [String(beat + 1), ...Array.from({ length: subdivision - 1 }, () => ".")].join(" ")).join(" ")} with a softer Click on each dot.`;

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
    sections: withSongTempo(markOwnTempos(song.sections, bpm), bpm),
  };
}

const SONG_COPY_DETAILS = "with the same Key, tempo, cues and Sections";

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
  const duplicateSong = useMutation(api.songs.duplicateSong);
  const library = useQuery(api.songs.list, { groupId });
  const theme = useTheme();
  const dockInset = useDockInset(Spacing.three);
  const pinned = usePinnedHeader();
  const [title, setTitle] = useState(song.title);
  const [songKey, setSongKey] = useState(song.key ?? "");
  const [countIn, setCountIn] = useState(song.countIn);
  const [subdivision, setSubdivision] = useState(song.subdivision);
  const [cueLeadBars, setCueLeadBars] = useState(song.cueLeadBars);
  const [songBpm, setSongBpm] = useState(() => startingBpmOf(song));
  const [rows, setRows] = useState<SectionRowState[]>(() => markOwnTempos(song.sections, startingBpmOf(song)).map((section, id) => ({ id, section })));
  const [nextRowId, setNextRowId] = useState(song.sections.length);
  const sections = withSongTempo(rows.map((row) => row.section), songBpm);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deletePending, setDeletePending] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const draft = { title, key: songKey, countIn, subdivision, cueLeadBars, bpm: songBpm, sections };
  const changed = !sameDraft(draft, savedDraftOf(song));
  const problem = draftProblem(draft);
  const [confirmingDuplicate, setConfirmingDuplicate] = useState(false);
  const [duplicatePending, setDuplicatePending] = useState(false);
  const [duplicateError, setDuplicateError] = useState<string | null>(null);
  const toast = useToast();
  const [askDiscard, setAskDiscard] = useState(false);
  const [departure, setDeparture] = useState<(() => void) | null>(null);
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
      if (changed) await updateSong({ songId, ...draft });
      const copy = await duplicateSong({ songId });
      if (mine !== attempt.current) return;
      setConfirmingDuplicate(false);
      setDeparture(() => () => router.replace({ pathname: "/group/[groupId]/song/[songId]", params: { groupId, songId: copy.songId } }));
    } catch (error) {
      if (mine !== attempt.current) toast.show(errorText(error), "error");
      else setDuplicateError(errorText(error));
    } finally {
      setDuplicatePending(false);
    }
  };
  const confirmDelete = async () => {
    if (deletePending) return;
    setDeleteError(null);
    setDeletePending(true);
    const mine = beginAttempt();
    try {
      await deleteSong({ songId });
      if (mine !== attempt.current) return;
      setConfirmingDelete(false);
      setDeparture(() => () => router.back());
    } catch (error) {
      if (mine !== attempt.current) toast.show(errorText(error), "error");
      else setDeleteError(errorText(error));
    } finally {
      setDeletePending(false);
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
        await Promise.all([updateSong({ songId, ...draft }), new Promise((done) => setTimeout(done, MIN_SAVING_MS))]);
        toast.show("Song saved");
      } finally {
        setSaving(false);
      }
    });

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
        <PinnedHeader scrolled={pinned.scrolled}>
          <ScreenHeader title="Edit Song" subtitle={song.title} onBack={() => router.back()} />
        </PinnedHeader>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" {...pinned.scrollProps}>
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
            <TapTempoButton testID="tap-tempo" onTempo={setSongBpm} />
            <ThemedText type="caption" themeColor="textSecondary">
              Tap along with the beat to set the Song tempo. Every Section plays at it unless you turn on Own tempo in that Section.
            </ThemedText>
            <Divider />
            <Switch
              label="Count-in"
              hint={`${cueLeadBars === 1 ? "One bar" : "Two bars"} of beat numbers before the first Section, while its Voice cue is spoken`}
              value={countIn}
              onChange={setCountIn}
              testID="count-in-toggle"
            />
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
              <ThemedText type="caption" themeColor="textSecondary" testID="cue-lead-pattern">
                {`Spoken as ${cuePattern(sections[0] ?? { beatsPerBar: 4 }, cueLeadBars)} over the ${cueLeadBars === 1 ? "bar" : "two bars"} before each Section${countIn ? `, with a ${cueLeadBars === 1 ? "one" : "two"}-bar Count-in` : ""}.`}
              </ThemedText>
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
              <ThemedText type="caption" themeColor="textSecondary" testID="subdivision-pattern">
                {subdivisionPattern(sections[0]?.beatsPerBar ?? 4, subdivision)}
              </ThemedText>
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
              setConfirmingDuplicate(true);
            }}
          />
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
            disabled={problem !== null}
            onPress={save}
          />
        </View>
        <ConfirmDialog
          visible={confirmingDuplicate}
          title={`Duplicate ${song.title}?`}
          message={
            changed
              ? `Your changes are saved to ${song.title} first. Then ${copyName ?? "a copy"} is added to the Song library ${SONG_COPY_DETAILS}.`
              : `${copyName ?? "A copy"} is added to the Song library ${SONG_COPY_DETAILS}.`
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
          visible={askDiscard && departure === null}
          title="Discard changes?"
          message={`Your edits to ${song.title} are not saved.`}
          confirmLabel="Discard"
          onConfirm={() => setDeparture(() => () => router.back())}
          onCancel={() => setAskDiscard(false)}
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
  container: { flex: 1 },
  subdivision: { gap: Spacing.two },
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
  changes: { gap: Spacing.two },
  changeRow: { gap: Spacing.two, padding: Spacing.two, borderRadius: Radius.md },
  changeRemove: { alignSelf: "flex-end" },
  addChange: { flexDirection: "row", alignItems: "center", gap: Spacing.one, minHeight: 44, alignSelf: "flex-start" },
  addChangePressed: { opacity: 0.7 },
  addChangeText: { fontSize: 15, lineHeight: 20, fontWeight: 600 },
  playsBadge: { flexDirection: "row", alignItems: "center", gap: 3, minHeight: 28, paddingHorizontal: Spacing.two, borderRadius: Radius.pill, marginLeft: Spacing.one },
  playsBadgeText: { fontSize: 15, lineHeight: 20, fontWeight: 700, fontVariant: ["tabular-nums"] },
  numberGroup: { gap: Spacing.one + 2, alignItems: "flex-start" },
  switchSlot: { minHeight: 44, justifyContent: "center" },
  fields: { flexDirection: "row", gap: Spacing.two },
  numberField: { flex: 1, minWidth: 0 },
  numberInput: { fontVariant: ["tabular-nums"] },
  timeField: { gap: Spacing.one + 2 },
  timeButton: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 44, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1 },
  timeText: { fontSize: 17, fontVariant: ["tabular-nums"] },
  centeredText: { textAlign: "center" },
  dock: { gap: Spacing.two, borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: Spacing.four, paddingVertical: Spacing.three },
});
