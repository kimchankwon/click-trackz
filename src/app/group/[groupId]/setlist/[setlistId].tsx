import { useMutation, useQuery } from "convex/react";
import { router, useLocalSearchParams } from "expo-router";
import { useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ActionButton } from "@/components/action-button";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Field } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { IconButton } from "@/components/ui/icon-button";
import { ScreenHeader } from "@/components/ui/screen-header";
import { MaxContentWidth, Radius, Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { errorText } from "@/lib/error-text";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";

type Entry = { songId: Id<"songs">; title: string; key: string; leader: string };
type LiveSetlist = {
  name: string;
  revision: number;
  entries: { songId: Id<"songs">; title: string; key: string | null; leader: string | null }[];
};

const toEntries = (setlist: LiveSetlist): Entry[] =>
  setlist.entries.map((e) => ({ songId: e.songId, title: e.title, key: e.key ?? "", leader: e.leader ?? "" }));

export default function SetlistScreen() {
  const params = useLocalSearchParams<{ groupId: string; setlistId: string }>();
  const groupId = params.groupId as Id<"groups">;
  const setlistId = params.setlistId as Id<"setlists">;
  const setlist = useQuery(api.setlists.get, { setlistId });
  const songs = useQuery(api.songs.list, { groupId });
  if (!setlist || !songs) return <ThemedView style={styles.container} />;
  return (
    <SetlistForm
      key={setlistId}
      groupId={groupId}
      setlistId={setlistId}
      live={setlist}
      songs={songs}
    />
  );
}

function SetlistForm({
  groupId,
  setlistId,
  live,
  songs,
}: {
  groupId: Id<"groups">;
  setlistId: Id<"setlists">;
  live: LiveSetlist;
  songs: { songId: Id<"songs">; title: string; key: string | null }[];
}) {
  const save = useMutation(api.setlists.save);
  const setCurrent = useMutation(api.setlists.setCurrent);
  const deleteSetlist = useMutation(api.setlists.deleteSetlist);
  const theme = useTheme();
  const [name, setName] = useState(live.name);
  const [entries, setEntriesState] = useState<Entry[]>(() => toEntries(live));
  const [revision, setRevision] = useState(live.revision);
  const [saving, setSaving] = useState(false);
  const saveInFlight = useRef(false);
  const changedElsewhere = live.revision !== revision;
  const loadLatest = () => {
    setName(live.name);
    setEntriesState(toEntries(live));
    setRevision(live.revision);
    setMessage(null);
  };
  const [message, setMessage] = useState<string | null>(null);
  const [showAdded, setShowAdded] = useState(false);
  const addedCount = songs.filter((song) => entries.some((entry) => entry.songId === song.songId)).length;
  const librarySongs = showAdded ? songs : songs.filter((song) => !entries.some((entry) => entry.songId === song.songId));

  const run = (action: () => Promise<unknown>) => {
    setMessage(null);
    action().catch((e: unknown) => setMessage(errorText(e)));
  };

  const update = (index: number, patch: Partial<Entry>) =>
    setEntriesState(entries.map((entry, i) => (i === index ? { ...entry, ...patch } : entry)));

  const move = (index: number, by: -1 | 1) => {
    const target = index + by;
    if (target < 0 || target >= entries.length) return;
    const next = [...entries];
    [next[index], next[target]] = [next[target], next[index]];
    setEntriesState(next);
  };

  const saveSetlist = () => {
    if (saveInFlight.current) return;
    saveInFlight.current = true;
    setSaving(true);
    run(async () => {
      try {
        await save({
          setlistId,
          revision,
          name,
          entries: entries.map((e) => ({ songId: e.songId, key: e.key, leader: e.leader })),
        });
        setRevision(revision + 1);
        setMessage("Saved");
      } finally {
        saveInFlight.current = false;
        setSaving(false);
      }
    });
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <ScreenHeader
            title="Edit Setlist"
            subtitle={live.name}
            onBack={() => router.back()}
            right={
              <ActionButton
                small
                variant="link"
                icon="star"
                label="Make current"
                testID="make-current"
                onPress={() =>
                  run(async () => {
                    await setCurrent({ groupId, setlistId });
                    setMessage("This is now the Current setlist");
                  })
                }
              />
            }
          />
          <Field label="Name" testID="setlist-name" value={name} onChangeText={setName} placeholder="Setlist name" />
          {changedElsewhere ? (
            <View style={[styles.conflict, { backgroundColor: theme.accentTint }]} testID="setlist-changed">
              <ThemedText type="small" style={styles.grow}>
                Another Admin changed this Setlist. Load their changes before you save; your edits here will be replaced.
              </ThemedText>
              <ActionButton small label="Load their changes" testID="load-latest" onPress={loadLatest} />
            </View>
          ) : null}

          <View style={styles.group}>
            <ThemedText type="label" themeColor="textSecondary" role="heading" style={styles.groupLabel}>
              Songs · {entries.length}
            </ThemedText>
            {entries.length === 0 ? (
              <ThemedText type="small" themeColor="textSecondary">
                No Songs yet. Add them from the library below.
              </ThemedText>
            ) : null}
            {entries.length > 0 ? (
              <View style={[styles.entries, { backgroundColor: theme.backgroundElement }]}>
                {entries.map((entry, index) => (
                  <View
                    key={`${entry.songId}-${index}`}
                    style={[styles.entry, index > 0 ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border } : null]}
                    testID={`entry-${index}`}
                  >
                    <View style={styles.entryTop}>
                      <ThemedText type="smallBold" themeColor="textTertiary" style={styles.entryIndex}>
                        {index + 1}
                      </ThemedText>
                      <ThemedText type="default" style={styles.entryTitle} numberOfLines={1}>
                        {entry.title}
                      </ThemedText>
                      <IconButton icon="up" color="textSecondary" label={`Move ${entry.title} up`} disabled={index === 0} onPress={() => move(index, -1)} />
                      <IconButton icon="down" color="textSecondary" label={`Move ${entry.title} down`} disabled={index === entries.length - 1} onPress={() => move(index, 1)} />
                      <IconButton
                        icon="trash"
                        color="textSecondary"
                        label={`Remove ${entry.title}`}
                        testID={`entry-${index}-remove`}
                        onPress={() => setEntriesState(entries.filter((_, i) => i !== index))}
                      />
                    </View>
                    <View style={styles.entryFields}>
                      <Field
                        testID={`entry-${index}-key`}
                        containerStyle={styles.keyInput}
                        value={entry.key}
                        onChangeText={(key) => update(index, { key })}
                        placeholder="Key"
                        compact
                        inset
                      />
                      <Field
                        testID={`entry-${index}-leader`}
                        containerStyle={styles.grow}
                        value={entry.leader}
                        onChangeText={(leader) => update(index, { leader })}
                        placeholder="Led by"
                        compact
                        inset
                      />
                    </View>
                  </View>
                ))}
              </View>
            ) : null}
          </View>

          <View style={styles.group}>
            <ThemedText type="label" themeColor="textSecondary" role="heading" style={styles.groupLabel}>
              Add from the library
            </ThemedText>
            {addedCount > 0 ? (
              <Pressable role="button" testID="toggle-added" onPress={() => setShowAdded(!showAdded)} style={styles.addedLine}>
                <ThemedText type="small" themeColor="textSecondary">
                  {addedCount} already in this Setlist ·{" "}
                </ThemedText>
                <ThemedText type="smallBold" themeColor="accent">
                  {showAdded ? "Hide them" : "Show them"}
                </ThemedText>
              </Pressable>
            ) : null}
            {librarySongs.length === 0 ? null : (
              <View style={[styles.library, { backgroundColor: theme.backgroundElement }]}>
                {librarySongs.map((song, index) => {
                  const added = entries.some((entry) => entry.songId === song.songId);
                  return (
                    <Pressable
                      key={song.songId}
                      role="button"
                      aria-label={`Add ${song.title}`}
                      testID={`add-${song.title}`}
                      onPress={() => setEntriesState([...entries, { songId: song.songId, title: song.title, key: song.key ?? "", leader: "" }])}
                      style={({ pressed }) => [
                        styles.libraryRow,
                        index > 0 ? { borderTopColor: theme.border, borderTopWidth: StyleSheet.hairlineWidth } : null,
                        pressed ? { backgroundColor: theme.backgroundSelected } : null,
                      ]}
                    >
                      <ThemedText style={[styles.grow, styles.libraryTitle, added ? styles.added : null]} numberOfLines={1}>
                        {song.title}
                      </ThemedText>
                      {song.key ? (
                        <ThemedText type="small" themeColor="textSecondary" style={added ? styles.added : null}>
                          {song.key}
                        </ThemedText>
                      ) : null}
                      {added ? <Icon name="check" size={20} color="textTertiary" /> : <Icon name="add" size={22} color="accent" />}
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>

          {message ? (
            <ThemedText type="small" themeColor="textSecondary" testID="setlist-message" style={styles.centeredText}>
              {message}
            </ThemedText>
          ) : null}
          <ActionButton
            variant="danger"
            icon="trash"
            label="Delete Setlist"
            accessibleName="Delete"
            testID="delete-setlist"
            onPress={() =>
              run(async () => {
                await deleteSetlist({ setlistId });
                router.back();
              })
            }
          />
        </ScrollView>
        <View style={[styles.dock, { backgroundColor: theme.background, borderTopColor: theme.border }]}>
          <ActionButton
            large
            full
            accent
            icon="check"
            label={saving ? "Saving…" : "Save Setlist"}
            accessibleName="Save"
            disabled={saving}
            testID="save-setlist"
            onPress={saveSetlist}
          />
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
  conflict: { flexDirection: "row", alignItems: "center", gap: Spacing.two, padding: Spacing.three, borderRadius: Radius.md },
  group: { gap: Spacing.two },
  groupLabel: { paddingHorizontal: Spacing.one },
  entries: { borderRadius: Radius.lg, overflow: "hidden" },
  entry: { gap: Spacing.two, paddingVertical: 12, paddingLeft: 12, paddingRight: Spacing.one },
  addedLine: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", minHeight: 32, paddingHorizontal: Spacing.one },
  libraryTitle: { fontSize: 16, fontWeight: 500 },
  added: { opacity: 0.5 },
  entryTop: { flexDirection: "row", alignItems: "center", gap: Spacing.one },
  entryIndex: { width: 22, fontVariant: ["tabular-nums"] },
  entryTitle: { flex: 1, minWidth: 0, fontWeight: 600, fontSize: 16 },
  entryFields: { flexDirection: "row", gap: Spacing.two, paddingRight: Spacing.two, paddingBottom: Spacing.one },
  keyInput: { width: 64 },
  grow: { flex: 1, minWidth: 0 },
  library: { borderRadius: Radius.lg, overflow: "hidden" },
  libraryRow: { flexDirection: "row", alignItems: "center", gap: Spacing.three, minHeight: 48, paddingHorizontal: Spacing.three },
  centeredText: { textAlign: "center" },
  dock: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: Spacing.four, paddingVertical: Spacing.three },
});
