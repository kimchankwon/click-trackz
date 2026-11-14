import { useMutation, useQuery } from "convex/react";
import { router, useLocalSearchParams, usePreventRemove } from "expo-router";
import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ActionButton } from "@/components/action-button";
import { Divider } from "@/components/group/card";
import { Chip } from "@/components/group/chip";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dropdown } from "@/components/ui/dropdown";
import { Field } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { IconButton } from "@/components/ui/icon-button";
import { ScreenHeader } from "@/components/ui/screen-header";
import { LetterStepper, NumberStepper } from "@/components/ui/stepper-input";
import { PinnedHeader, PINNED_CONTENT_TOP, usePinnedHeader } from "@/components/ui/pinned-header";
import { Segmented } from "@/components/ui/segmented";
import { useDockInset } from "@/components/ui/use-dock-inset";
import { Switch } from "@/components/ui/switch";
import { Toast, useToast } from "@/components/ui/toast";
import { ControlHeight, MaxContentWidth, Radius, Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { copyBaseOf, copyTitle } from "@/lib/copy-title";
import { errorText } from "@/lib/error-text";
import { canEditSongs } from "@/lib/roles";
import { draftProblem, MAX_BPM, MIN_BPM, sameDraft, type SongDraft } from "@/lib/song-draft";
import { InsertSectionGap } from "@/components/song/insert-section-gap";
import { MoveHandle } from "@/components/song/move-handle";
import { TapTempoButton } from "@/components/song/tap-tempo-button";
import { insertAt, newSectionAfter } from "@/sync/new-section";
import { commonBpm, DEFAULT_BPM, markOwnTempos, withSongTempo } from "@/sync/song-tempo";
import { markOwnTimes, sameTime, startingSongTime, withSongTime, type SongTimeSignature, type TimeSignature } from "@/sync/song-time";
import { newTimeChange } from "@/sync/time-changes";
import { MAX_SECTION_NUMBER, timeKeyOf, timeOfKey, timeOptions } from "@/lib/section-options";
import { CUE_LEAD_BARS, MAX_BARS, MAX_PLAYS, playsOf, SUBDIVISIONS, type Section, type SectionLetter, type TimeChange } from "@/sync/timeline";
import { useGuestStaysWhileEditing } from "@/presence/use-presence";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";

const MIN_SAVING_MS = 400;
const STEPPER_WIDTH = 56;
const TAG_WIDTH = 44;
const LETTER_WIDTH = 48;
const BARS_WIDTH = 50;
const BARS_RANGE = { min: 1, max: MAX_BARS };
const PLAYS_RANGE = { min: 1, max: MAX_PLAYS };
const SECTION_BPM_RANGE = { min: MIN_BPM, max: MAX_BPM, optional: true };
const SECTION_NUMBER_RANGE = { min: 1, max: MAX_SECTION_NUMBER, optional: true };

type EditableSection = Section & { customLabel?: string; ownTempo?: boolean; ownTime?: boolean };

function withPlays(section: EditableSection, plays: number): EditableSection {
  const next = Math.min(MAX_PLAYS, Math.max(1, plays));
  return { ...section, plays: next > 1 ? next : undefined };
}

const FOLLOW_SONG = "song";

function LabeledField({ label, width, children }: { label: string; width?: number; children: ReactNode }) {
  return (
    <View style={width === undefined ? styles.field : [styles.fixedField, { width }]}>
      <ThemedText themeColor="textSecondary" style={[styles.fieldLabel, width === undefined ? null : styles.centeredLabel]} numberOfLines={1}>
        {label}
      </ThemedText>
      <View style={styles.fieldBody}>{children}</View>
    </View>
  );
}

function TimeSignatureField({ section, testID, onChange }: { section: TimeSignature; testID: string; onChange: (next: TimeSignature) => void }) {
  return (
    <LabeledField label="Time">
      <Dropdown
        look="field"
        label="Time signature"
        testID={testID}
        menuMinWidth={MENU_MIN_WIDTH}
        options={timeOptions(section)}
        value={timeKeyOf(section)}
        onChange={(key) => onChange(timeOfKey(key))}
      />
    </LabeledField>
  );
}

function TimeChangeRow({ change, sectionBars, testID, onChange, onRemove }: { change: TimeChange; sectionBars: number; testID: string; onChange: (next: TimeChange) => void; onRemove: () => void }) {
  const theme = useTheme();
  const within = { min: 1, max: Math.max(1, sectionBars) };
  return (
    <View style={[styles.changeRow, { backgroundColor: theme.background }]} testID={testID}>
      <LabeledField label="From bar" width={STEPPER_WIDTH}>
        <NumberStepper label="From bar" testID={`${testID}-bar`} value={change.bar} range={within} onChange={(bar) => onChange({ ...change, bar: bar ?? change.bar })} />
      </LabeledField>
      <LabeledField label="Bars" width={STEPPER_WIDTH}>
        <NumberStepper label="Bars" testID={`${testID}-bars`} value={change.bars} range={within} onChange={(bars) => onChange({ ...change, bars: bars ?? change.bars })} />
      </LabeledField>
      <TimeSignatureField section={change} testID={`${testID}-time`} onChange={(time) => onChange({ ...change, ...time })} />
      <IconButton icon="trash" color="textTertiary" size={40} label={`Remove the time change at bar ${change.bar}`} onPress={onRemove} testID={`${testID}-remove`} />
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

const MENU_MIN_WIDTH = 120;

function SectionRow({
  section,
  songBpm,
  songTime,
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
  songTime: TimeSignature;
  index: number;
  count: number;
  vocabulary: readonly string[];
  onChange: (next: EditableSection) => void;
  onMove: (by: -1 | 1) => void;
  onDuplicate: () => void;
  onRemove: () => void;
}) {
  const theme = useTheme();
  const plays = playsOf(section);
  const changes = section.timeChanges ?? [];
  const addedChange = newTimeChange(section);
  const updateChanges = (timeChanges: TimeChange[]) => onChange({ ...section, timeChanges: timeChanges.length > 0 ? timeChanges : undefined });
  const ownTempo = section.ownTempo === true;
  const ownTime = section.ownTime === true;
  const [bpmOpen, setBpmOpen] = useState(false);
  const showBpm = ownTempo || bpmOpen;
  const name = `Section ${index + 1}`;
  const followTime = (key: string) =>
    key === FOLLOW_SONG || sameTime(timeOfKey(key), songTime)
      ? onChange({ ...section, ...songTime, ownTime: false })
      : onChange({ ...section, ...timeOfKey(key), ownTime: true });
  const toggleBpm = () => {
    if (showBpm) {
      setBpmOpen(false);
      if (ownTempo) onChange({ ...section, ownTempo: false, bpm: songBpm });
    } else setBpmOpen(true);
  };
  return (
    <View style={[styles.sectionCard, { backgroundColor: theme.backgroundElement }]} testID={`section-${index}`}>
      <MoveHandle by={-1} name={name} enabled={index > 0} onMove={onMove} testID={`section-${index}-up`} />
      <View style={styles.sectionTop}>
        <View style={styles.headMain}>
          <Dropdown
            look="field"
            label={`Section type of ${name}`}
            testID={`section-${index}-type`}
            options={vocabulary.map((type) => ({ value: type, label: type }))}
            value={section.sectionType}
            onChange={(sectionType) => onChange({ ...section, sectionType })}
            shown={
              <ThemedText style={styles.typeText} numberOfLines={1}>
                {section.sectionType}
              </ThemedText>
            }
          />
          <Dropdown
            look="field"
            label={`Time signature of ${name}`}
            testID={`section-${index}-time`}
            muted={!ownTime}
            menuMinWidth={MENU_MIN_WIDTH}
            options={[{ value: FOLLOW_SONG, label: `Song (${timeKeyOf(songTime)})` }, ...timeOptions(section)]}
            value={ownTime ? timeKeyOf(section) : FOLLOW_SONG}
            onChange={followTime}
            shown={
              <ThemedText themeColor={ownTime ? "text" : "textSecondary"} style={styles.typeText} numberOfLines={1}>
                {timeKeyOf(ownTime ? section : songTime)}
              </ThemedText>
            }
          />
        </View>
        <LabeledField label="No." width={TAG_WIDTH}>
          <NumberStepper
            label={`Number of ${name}`}
            testID={`section-${index}-number`}
            value={section.number}
            range={SECTION_NUMBER_RANGE}
            placeholder="–"
            onChange={(number) => onChange(number === undefined ? { ...section, number: undefined, letter: undefined } : { ...section, number })}
          />
        </LabeledField>
        <LabeledField label="Sub" width={LETTER_WIDTH}>
          <LetterStepper
            label={`Letter after the number of ${name}`}
            testID={`section-${index}-letter`}
            value={section.number ? section.letter : undefined}
            disabled={!section.number}
            onChange={(letter) => onChange({ ...section, letter: letter as SectionLetter | undefined })}
          />
        </LabeledField>
        <LabeledField label="Bars" width={BARS_WIDTH}>
          <NumberStepper label={`Bars of ${name}`} testID={`section-${index}-bars`} value={section.bars} range={BARS_RANGE} onChange={(bars) => onChange({ ...section, bars: bars ?? section.bars })} />
        </LabeledField>
        <LabeledField label="Plays" width={TAG_WIDTH}>
          <NumberStepper label={`Plays of ${name}`} testID={`section-${index}-plays`} value={plays} range={PLAYS_RANGE} onChange={(next) => onChange(withPlays(section, next ?? plays))} />
        </LabeledField>
      </View>
      {showBpm ? (
        <View style={[styles.changeRow, styles.bpmRow, { backgroundColor: theme.background }]} testID={`section-${index}-bpm-row`}>
          <LabeledField label="BPM" width={BARS_WIDTH}>
            <NumberStepper
              label={`BPM of ${name}`}
              testID={`section-${index}-bpm`}
              value={ownTempo ? section.bpm : undefined}
              range={SECTION_BPM_RANGE}
              placeholder={String(songBpm)}
              stepFrom={songBpm}
              muted
              onChange={(bpm) => onChange(bpm === undefined || bpm === songBpm ? { ...section, ownTempo: false, bpm: songBpm } : { ...section, ownTempo: true, bpm })}
            />
          </LabeledField>
          <ThemedText type="small" themeColor="textSecondary" style={styles.grow}>
            {ownTempo ? `Song is ${songBpm} BPM` : `Follows the Song, ${songBpm} BPM`}
          </ThemedText>
        </View>
      ) : null}
      {changes.map((change, changeIndex) => (
        <TimeChangeRow
          key={changeIndex}
          change={change}
          sectionBars={section.bars}
          testID={`section-${index}-change-${changeIndex}`}
          onChange={(edited) => updateChanges(changes.map((other, otherIndex) => (otherIndex === changeIndex ? edited : other)))}
          onRemove={() => updateChanges(changes.filter((_, otherIndex) => otherIndex !== changeIndex))}
        />
      ))}
      <View style={styles.footer}>
        {addedChange ? (
          <Pressable
            role="button"
            aria-label={`Add a subsection to ${name}`}
            testID={`section-${index}-add-change`}
            onPress={() => updateChanges([...changes, addedChange])}
            style={({ pressed }) => [styles.addChange, pressed ? styles.addChangePressed : null]}
          >
            <Icon name="add" size={16} color="accent" />
            <ThemedText themeColor="accent" style={styles.addChangeText}>
              Subsection
            </ThemedText>
          </Pressable>
        ) : null}
        <Pressable
          role="switch"
          aria-checked={showBpm}
          aria-label={`Own tempo for ${name}`}
          testID={`section-${index}-bpm-toggle`}
          onPress={toggleBpm}
          style={({ pressed }) => [
            styles.footerChip,
            { backgroundColor: showBpm ? theme.accentTint : theme.backgroundSelected, borderColor: showBpm ? theme.accent : "transparent" },
            pressed ? styles.addChangePressed : null,
          ]}
        >
          <ThemedText themeColor={showBpm ? "accent" : "textSecondary"} style={styles.addChangeText}>
            BPM
          </ThemedText>
        </Pressable>
        <View style={styles.voiceCue}>
          <ThemedText themeColor="textSecondary" style={styles.fieldLabel}>
            Voice cue
          </ThemedText>
          <Switch bare label={`Voice cue for ${name}`} testID={`section-${index}-voice-cue`} value={section.voiceCueEnabled !== false} onChange={(on) => onChange({ ...section, voiceCueEnabled: on })} />
        </View>
      </View>
      <View style={styles.cardEdge}>
        <IconButton icon="copy" color="textTertiary" size={32} label={`Duplicate ${name}`} onPress={onDuplicate} testID={`section-${index}-duplicate`} />
        <MoveHandle by={1} name={name} enabled={index < count - 1} onMove={onMove} testID={`section-${index}-down`} />
        <IconButton icon="trash" color="textTertiary" size={32} label={`Remove ${name}`} onPress={onRemove} testID={`section-${index}-remove`} />
      </View>
    </View>
  );
}

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

export default function SongEditorScreen() {
  const params = useLocalSearchParams<{ groupId: string; songId: string }>();
  const songId = params.songId as Id<"songs">;
  const groupId = params.groupId as Id<"groups">;
  const song = useQuery(api.songs.get, { songId });
  const vocabulary = useQuery(api.vocabulary.list, { groupId });
  useGuestStaysWhileEditing(groupId);
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
  const sections = withSongTime(withSongTempo(rows.map((row) => row.section), songBpm), songTime);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deletePending, setDeletePending] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const draft = { title, key: songKey, countIn, subdivision, cueLeadBars, bpm: songBpm, timeSignature: songTime, sections };
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
      if (changed) await updateSong({ songId, ...draft });
      const copy = await copyToGroup({ songId, toGroupId: copyTarget });
      toast.show(`${copy.title} is now in ${copy.groupName}`);
      if (mine === attempt.current) setCopyOpen(false);
    } catch (error) {
      if (mine !== attempt.current) toast.show(errorText(error), "error");
      else setCopyError(errorText(error));
    } finally {
      setCopyPending(false);
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
                onPress={() => setCopyTarget(target.groupId)}
              />
            ))}
          </ScrollView>
        </ConfirmDialog>
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
  footer: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: Spacing.two, minHeight: 36 },
  voiceCue: { flexDirection: "row", alignItems: "center", gap: Spacing.two, marginLeft: "auto" },
  bpmRow: { alignItems: "center" },
  cardEdge: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  detailsCard: { gap: Spacing.three, padding: Spacing.three, borderRadius: Radius.lg },
  fieldLabel: { fontSize: 13, lineHeight: 18, fontWeight: 600 },
  centeredLabel: { textAlign: "center" },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.two },
  grow: { flex: 1, minWidth: 0 },
  sectionCard: { gap: Spacing.two, paddingHorizontal: 12, paddingVertical: Spacing.one + 2, borderRadius: Radius.lg },
  footerChip: { minHeight: 30, paddingHorizontal: Spacing.two + 2, borderRadius: 15, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  sectionTop: { flexDirection: "row", alignItems: "flex-end", gap: 6 },
  headMain: { flex: 1, minWidth: 0, gap: Spacing.one },
  typeText: { fontWeight: 600, fontSize: 15, flexShrink: 1, fontVariant: ["tabular-nums"] },
  field: { flex: 1, minWidth: 0, gap: Spacing.one + 2 },
  fixedField: { gap: Spacing.one + 2 },
  fieldBody: { flex: 1, justifyContent: "center" },
  changeRow: { flexDirection: "row", alignItems: "flex-end", gap: Spacing.two, padding: Spacing.two, borderRadius: Radius.md },
  addChange: { flexDirection: "row", alignItems: "center", gap: Spacing.one, minHeight: 36 },
  addChangePressed: { opacity: 0.7 },
  addChangeText: { fontSize: 14, lineHeight: 20, fontWeight: 600 },
  fields: { flexDirection: "row", gap: Spacing.two },
  numberField: { flex: 1, minWidth: 0 },
  numberInput: { fontVariant: ["tabular-nums"], paddingHorizontal: 10 },
  centeredText: { textAlign: "center" },
  dock: { gap: Spacing.two, borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: Spacing.four, paddingVertical: Spacing.three },
});
