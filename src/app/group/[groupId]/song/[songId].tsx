import { useAction, useMutation, useQuery } from "convex/react";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Linking, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ActionButton } from "@/components/action-button";
import { Divider } from "@/components/group/card";
import { Chip } from "@/components/group/chip";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Field } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { IconButton } from "@/components/ui/icon-button";
import { ReorderControl } from "@/components/ui/reorder-control";
import { ScreenHeader } from "@/components/ui/screen-header";
import { Switch } from "@/components/ui/switch";
import { MaxContentWidth, Radius, Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { errorText } from "@/lib/error-text";
import type { Section } from "@/sync/timeline";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";

type EditableSection = Section & { customLabel?: string };
type SectionRowState = { id: number; section: EditableSection };

type LookupResult = { title: string; artist: string | null; bpm: number | null; beatsPerBar: number | null; key: string | null };

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

function SectionRow({
  section,
  index,
  count,
  vocabulary,
  onChange,
  onMove,
  onRemove,
}: {
  section: EditableSection;
  index: number;
  count: number;
  vocabulary: readonly string[];
  onChange: (next: EditableSection) => void;
  onMove: (by: -1 | 1) => void;
  onRemove: () => void;
}) {
  const theme = useTheme();
  const [choosing, setChoosing] = useState(false);
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
        <View style={styles.trashGap} />
        <IconButton icon="trash" color="danger" size={40} label={`Remove Section ${index + 1}`} onPress={onRemove} testID={`section-${index}-remove`} />
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
        <NumberField
          label="Beats/bar"
          value={section.beatsPerBar}
          testID={`section-${index}-beats`}
          onChange={(beatsPerBar) => onChange({ ...section, beatsPerBar })}
        />
        <NumberField label="BPM" value={section.bpm} testID={`section-${index}-bpm`} onChange={(bpm) => onChange({ ...section, bpm })} />
      </View>
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
        <View style={styles.grow}>
          <Switch label="Voice cue" value={section.voiceCueEnabled !== false} onChange={(on) => onChange({ ...section, voiceCueEnabled: on })} />
        </View>
      </View>
    </View>
  );
}

type LoadedSong = {
  title: string;
  key: string | null;
  tempoHint: { bpm: number; beatsPerBar: number } | null;
  countIn: boolean;
  sections: EditableSection[];
};

export default function SongEditorScreen() {
  const params = useLocalSearchParams<{ groupId: string; songId: string }>();
  const songId = params.songId as Id<"songs">;
  const groupId = params.groupId as Id<"groups">;
  const song = useQuery(api.songs.get, { songId });
  const vocabulary = useQuery(api.recordings.vocabulary, { groupId });
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
  const lookupAvailable = useQuery(api.bpm.lookupAvailable, {});
  const lookup = useAction(api.bpm.lookup);
  const theme = useTheme();
  const [title, setTitle] = useState(song.title);
  const [songKey, setSongKey] = useState(song.key ?? "");
  const [countIn, setCountIn] = useState(song.countIn);
  const [rows, setRows] = useState<SectionRowState[]>(() => song.sections.map((section, id) => ({ id, section })));
  const [nextRowId, setNextRowId] = useState(song.sections.length);
  const sections = rows.map((row) => row.section);
  const [results, setResults] = useState<LookupResult[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const run = (action: () => Promise<unknown>) => {
    setMessage(null);
    action().catch((e: unknown) => setMessage(errorText(e)));
  };

  const addSection = () => {
    const last = sections.at(-1);
    setRows([
      ...rows,
      {
        id: nextRowId,
        section: {
          sectionType: last ? "Verse" : "Intro",
          bars: 4,
          beatsPerBar: last?.beatsPerBar ?? song.tempoHint?.beatsPerBar ?? 4,
          bpm: last?.bpm ?? song.tempoHint?.bpm ?? 72,
        },
      },
    ]);
    setNextRowId(nextRowId + 1);
  };

  const move = (index: number, by: -1 | 1) => {
    const target = index + by;
    if (target < 0 || target >= rows.length) return;
    const next = [...rows];
    [next[index], next[target]] = [next[target], next[index]];
    setRows(next);
  };

  const applyLookup = (result: LookupResult) => {
    if (result.key) setSongKey(result.key);
    setRows(
      rows.map((row) => ({
        id: row.id,
        section: {
          ...row.section,
          ...(result.bpm ? { bpm: result.bpm } : {}),
          ...(result.beatsPerBar ? { beatsPerBar: result.beatsPerBar } : {}),
        },
      })),
    );
    setResults(null);
    setMessage(`Applied ${result.bpm ?? "?"} BPM to every Section`);
  };

  const save = () =>
    run(async () => {
      await updateSong({ songId, title, key: songKey, countIn, sections });
      setMessage("Saved");
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
            <Field label="Key" testID="song-key-input" value={songKey} onChangeText={setSongKey} placeholder="e.g. D" />
            <Divider />
            <Switch label="Count-in" hint="One bar of beat numbers before the first Section" value={countIn} onChange={setCountIn} testID="count-in-toggle" />
          </View>

          {lookupAvailable ? (
            <View style={styles.group}>
              <ActionButton
                icon="speed"
                label="Look up BPM and key"
                testID="lookup-bpm"
                disabled={title.trim() === ""}
                onPress={() => run(async () => setResults(await lookup({ groupId, title })))}
              />
              {(results ?? []).map((result, index) => (
                <Pressable
                  key={index}
                  role="button"
                  onPress={() => applyLookup(result)}
                  style={[styles.result, { backgroundColor: theme.backgroundElement }]}
                >
                  <View style={styles.grow}>
                    <ThemedText type="smallBold" numberOfLines={1}>
                      {result.title}
                    </ThemedText>
                    <ThemedText type="caption" themeColor="textSecondary" numberOfLines={1}>
                      {[result.artist, `${result.bpm ?? "?"} BPM`, result.beatsPerBar ? `${result.beatsPerBar}/4` : null, result.key]
                        .filter(Boolean)
                        .join(" · ")}
                    </ThemedText>
                  </View>
                  <ThemedText type="smallBold" themeColor="accent">
                    Use
                  </ThemedText>
                </Pressable>
              ))}
              {results?.length === 0 ? (
                <ThemedText type="small" themeColor="textSecondary">
                  No matches
                </ThemedText>
              ) : null}
              <Pressable role="link" onPress={() => void Linking.openURL("https://getsongbpm.com")}>
                <ThemedText type="caption" themeColor="textSecondary" style={styles.credit}>
                  BPM data from GetSongBPM
                </ThemedText>
              </Pressable>
            </View>
          ) : null}

          <View style={styles.group}>
            <ThemedText type="label" themeColor="textSecondary" role="heading" style={styles.groupLabel}>
              Sections · {rows.length}
            </ThemedText>
            {rows.map((row, index) => (
              <SectionRow
                key={row.id}
                section={row.section}
                index={index}
                count={rows.length}
                vocabulary={vocabulary}
                onChange={(next) => setRows(rows.map((r) => (r.id === row.id ? { id: r.id, section: next } : r)))}
                onMove={(by) => move(index, by)}
                onRemove={() => setRows(rows.filter((r) => r.id !== row.id))}
              />
            ))}
            <ActionButton icon="add" label="Add Section" testID="add-section" onPress={addSection} />
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
            onPress={() =>
              run(async () => {
                router.back();
                await deleteSong({ songId });
              })
            }
          />
        </ScrollView>
        <View style={[styles.dock, { backgroundColor: theme.background, borderTopColor: theme.border }]}>
          <ActionButton large full accent icon="check" label="Save Song" accessibleName="Save" testID="save-song" onPress={save} />
        </View>
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
  trashGap: { width: Spacing.three },
  bottomRow: { flexDirection: "row", alignItems: "flex-end", gap: Spacing.four },
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
  fields: { flexDirection: "row", gap: Spacing.two },
  numberField: { flex: 1, minWidth: 0 },
  numberInput: { fontVariant: ["tabular-nums"] },
  result: { flexDirection: "row", alignItems: "center", gap: Spacing.three, padding: Spacing.three, borderRadius: Radius.md },
  credit: { textDecorationLine: "underline" },
  centeredText: { textAlign: "center" },
  dock: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: Spacing.four, paddingVertical: Spacing.three },
});
