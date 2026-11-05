import { useAction, useMutation, useQuery } from "convex/react";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Linking, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { MaxContentWidth, Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { errorText } from "@/lib/error-text";
import type { Section } from "@/sync/timeline";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";

type EditableSection = Section & { customLabel?: string };

type LookupResult = { title: string; artist: string | null; bpm: number | null; beatsPerBar: number | null; key: string | null };

function SmallButton({ label, onPress, testID, accent }: { label: string; onPress: () => void; testID?: string; accent?: boolean }) {
  const theme = useTheme();
  return (
    <Pressable
      role="button"
      testID={testID}
      onPress={onPress}
      style={[styles.small, { backgroundColor: accent ? theme.accent : theme.backgroundElement }]}
    >
      <ThemedText type="small" style={accent ? { color: theme.onAccent } : null}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

function NumberField({ label, value, onChange, testID }: { label: string; value: number; onChange: (next: number) => void; testID: string }) {
  const theme = useTheme();
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <View style={styles.numberField}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <TextInput
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
        style={[styles.numberInput, { color: theme.text, backgroundColor: theme.backgroundElement }]}
      />
    </View>
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
    <View style={[styles.sectionRow, { borderColor: theme.backgroundSelected }]} testID={`section-${index}`}>
      <View style={styles.inline}>
        <Pressable
          role="button"
          testID={`section-${index}-type`}
          onPress={() => setChoosing(!choosing)}
          style={[styles.small, { backgroundColor: theme.accentSoft }]}
        >
          <ThemedText type="smallBold">
            {section.sectionType}
            {section.number ? ` ${section.number}` : ""}
          </ThemedText>
        </Pressable>
        <SmallButton label="−" testID={`section-${index}-number-down`} onPress={() => onChange({ ...section, number: section.number && section.number > 1 ? section.number - 1 : undefined })} />
        <SmallButton label="#+" testID={`section-${index}-number-up`} onPress={() => onChange({ ...section, number: Math.min(9, (section.number ?? 0) + 1) })} />
        <View style={styles.grow} />
        <SmallButton label="↑" onPress={() => onMove(-1)} testID={index === 0 ? undefined : `section-${index}-up`} />
        <SmallButton label="↓" onPress={() => onMove(1)} testID={index === count - 1 ? undefined : `section-${index}-down`} />
        <SmallButton label="✕" onPress={onRemove} testID={`section-${index}-remove`} />
      </View>
      {choosing ? (
        <View style={styles.wrap}>
          {vocabulary.map((type) => (
            <SmallButton
              key={type}
              label={type}
              accent={type === section.sectionType}
              testID={`section-${index}-type-${type}`}
              onPress={() => {
                onChange({ ...section, sectionType: type });
                setChoosing(false);
              }}
            />
          ))}
        </View>
      ) : null}
      <View style={styles.inline}>
        <NumberField label="Bars" value={section.bars} testID={`section-${index}-bars`} onChange={(bars) => onChange({ ...section, bars })} />
        <NumberField
          label="Beats/bar"
          value={section.beatsPerBar}
          testID={`section-${index}-beats`}
          onChange={(beatsPerBar) => onChange({ ...section, beatsPerBar })}
        />
        <NumberField label="BPM" value={section.bpm} testID={`section-${index}-bpm`} onChange={(bpm) => onChange({ ...section, bpm })} />
      </View>
      <Pressable
        role="switch"
        aria-checked={section.voiceCueEnabled !== false}
        onPress={() => onChange({ ...section, voiceCueEnabled: section.voiceCueEnabled === false })}
      >
        <ThemedText type="small" themeColor="textSecondary">
          Voice cue {section.voiceCueEnabled === false ? "off" : "on"}
        </ThemedText>
      </Pressable>
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
  return <SongForm key={songId} songId={songId} song={song} vocabulary={vocabulary} />;
}

function SongForm({ songId, song, vocabulary }: { songId: Id<"songs">; song: LoadedSong; vocabulary: readonly string[] }) {
  const updateSong = useMutation(api.songs.updateSong);
  const deleteSong = useMutation(api.songs.deleteSong);
  const lookupAvailable = useQuery(api.bpm.lookupAvailable, {});
  const lookup = useAction(api.bpm.lookup);
  const theme = useTheme();
  const [title, setTitle] = useState(song.title);
  const [songKey, setSongKey] = useState(song.key ?? "");
  const [countIn, setCountIn] = useState(song.countIn);
  const [sections, setSections] = useState<EditableSection[]>(song.sections);
  const [results, setResults] = useState<LookupResult[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const run = (action: () => Promise<unknown>) => {
    setMessage(null);
    action().catch((e: unknown) => setMessage(errorText(e)));
  };

  const addSection = () => {
    const last = sections.at(-1);
    setSections([
      ...sections,
      {
        sectionType: last ? "Verse" : "Intro",
        bars: 4,
        beatsPerBar: last?.beatsPerBar ?? song.tempoHint?.beatsPerBar ?? 4,
        bpm: last?.bpm ?? song.tempoHint?.bpm ?? 72,
      },
    ]);
  };

  const move = (index: number, by: -1 | 1) => {
    const target = index + by;
    if (target < 0 || target >= sections.length) return;
    const next = [...sections];
    [next[index], next[target]] = [next[target], next[index]];
    setSections(next);
  };

  const applyLookup = (result: LookupResult) => {
    if (result.key) setSongKey(result.key);
    setSections(
      sections.map((section) => ({
        ...section,
        ...(result.bpm ? { bpm: result.bpm } : {}),
        ...(result.beatsPerBar ? { beatsPerBar: result.beatsPerBar } : {}),
      })),
    );
    setResults(null);
    setMessage(`Applied ${result.bpm ?? "?"} BPM to every Section`);
  };

  const input = [styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }];

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <ThemedText type="subtitle">Edit Song</ThemedText>
          {song.tempoHint && sections.length === 0 ? (
            <ThemedText type="small" themeColor="textSecondary" testID="tempo-hint">
              Suggested tempo {song.tempoHint.bpm} BPM, {song.tempoHint.beatsPerBar} beats per bar
            </ThemedText>
          ) : null}
          <TextInput testID="song-title-input" style={input} value={title} onChangeText={setTitle} placeholder="Title" />
          <View style={styles.inline}>
            <TextInput testID="song-key-input" style={[input, styles.keyInput]} value={songKey} onChangeText={setSongKey} placeholder="Key" />
            <Pressable role="switch" aria-checked={countIn} testID="count-in-toggle" onPress={() => setCountIn(!countIn)}>
              <ThemedText>Count-in {countIn ? "on" : "off"}</ThemedText>
            </Pressable>
          </View>

          {lookupAvailable ? (
            <View style={styles.lookup}>
              <SmallButton
                label="Look up BPM"
                testID="lookup-bpm"
                onPress={() => run(async () => setResults(await lookup({ title })))}
              />
              <Pressable onPress={() => void Linking.openURL("https://getsongbpm.com")}>
                <ThemedText type="small" themeColor="textSecondary">
                  BPM data from GetSongBPM
                </ThemedText>
              </Pressable>
              {(results ?? []).map((result, index) => (
                <Pressable key={index} role="button" onPress={() => applyLookup(result)} style={[styles.result, { backgroundColor: theme.backgroundElement }]}>
                  <ThemedText type="small">
                    {result.title}
                    {result.artist ? ` · ${result.artist}` : ""} · {result.bpm ?? "?"} BPM
                    {result.beatsPerBar ? ` · ${result.beatsPerBar}/4` : ""}
                    {result.key ? ` · ${result.key}` : ""}
                  </ThemedText>
                </Pressable>
              ))}
              {results?.length === 0 ? <ThemedText type="small">No matches</ThemedText> : null}
            </View>
          ) : null}

          {sections.map((section, index) => (
            <SectionRow
              key={index}
              section={section}
              index={index}
              count={sections.length}
              vocabulary={vocabulary}
              onChange={(next) => setSections(sections.map((s, i) => (i === index ? next : s)))}
              onMove={(by) => move(index, by)}
              onRemove={() => setSections(sections.filter((_, i) => i !== index))}
            />
          ))}
          <SmallButton label="+ Add Section" testID="add-section" onPress={addSection} />

          <View style={styles.inline}>
            <SmallButton
              label="Save"
              accent
              testID="save-song"
              onPress={() =>
                run(async () => {
                  await updateSong({ songId, title, key: songKey, countIn, sections });
                  setMessage("Saved");
                })
              }
            />
            <SmallButton label="Back" testID="back" onPress={() => router.back()} />
            <View style={styles.grow} />
            <SmallButton
              label="Delete Song"
              testID="delete-song"
              onPress={() =>
                run(async () => {
                  router.back();
                  await deleteSong({ songId });
                })
              }
            />
          </View>
          {message ? (
            <ThemedText themeColor="textSecondary" testID="editor-message">
              {message}
            </ThemedText>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { gap: Spacing.three, padding: Spacing.four, maxWidth: MaxContentWidth, alignSelf: "center", width: "100%" },
  input: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.three, borderRadius: Spacing.three, fontSize: 16 },
  keyInput: { width: 96 },
  inline: { flexDirection: "row", alignItems: "center", gap: Spacing.two, flexWrap: "wrap" },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.one },
  grow: { flex: 1 },
  small: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, borderRadius: Spacing.three },
  sectionRow: { gap: Spacing.two, padding: Spacing.three, borderWidth: 1, borderRadius: Spacing.three },
  numberField: { gap: Spacing.half, flex: 1, minWidth: 80 },
  numberInput: { paddingHorizontal: Spacing.two, paddingVertical: Spacing.two, borderRadius: Spacing.two, fontSize: 16 },
  lookup: { gap: Spacing.two },
  result: { padding: Spacing.two, borderRadius: Spacing.two },
});
