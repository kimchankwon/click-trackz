import { useMutation, useQuery } from "convex/react";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { MaxContentWidth, Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { errorText } from "@/lib/error-text";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";

type Entry = { songId: Id<"songs">; title: string; key: string; leader: string };

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
      initialName={setlist.name}
      initialEntries={setlist.entries.map((e) => ({ songId: e.songId, title: e.title, key: e.key ?? "", leader: e.leader ?? "" }))}
      songs={songs}
    />
  );
}

function SetlistForm({
  groupId,
  setlistId,
  initialName,
  initialEntries,
  songs,
}: {
  groupId: Id<"groups">;
  setlistId: Id<"setlists">;
  initialName: string;
  initialEntries: Entry[];
  songs: { songId: Id<"songs">; title: string; key: string | null }[];
}) {
  const setEntries = useMutation(api.setlists.setEntries);
  const rename = useMutation(api.setlists.rename);
  const setCurrent = useMutation(api.setlists.setCurrent);
  const deleteSetlist = useMutation(api.setlists.deleteSetlist);
  const theme = useTheme();
  const [name, setName] = useState(initialName);
  const [entries, setEntriesState] = useState<Entry[]>(initialEntries);
  const [message, setMessage] = useState<string | null>(null);
  const input = [styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }];

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

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <ThemedText type="subtitle">Edit Setlist</ThemedText>
          <TextInput testID="setlist-name" style={input} value={name} onChangeText={setName} placeholder="Setlist name" />

          {entries.map((entry, index) => (
            <View key={`${entry.songId}-${index}`} style={[styles.entry, { borderColor: theme.backgroundSelected }]} testID={`entry-${index}`}>
              <View style={styles.inline}>
                <ThemedText type="smallBold" style={styles.grow}>
                  {index + 1}. {entry.title}
                </ThemedText>
                <SmallButton label="↑" onPress={() => move(index, -1)} />
                <SmallButton label="↓" onPress={() => move(index, 1)} />
                <SmallButton label="✕" testID={`entry-${index}-remove`} onPress={() => setEntriesState(entries.filter((_, i) => i !== index))} />
              </View>
              <View style={styles.inline}>
                <TextInput
                  testID={`entry-${index}-key`}
                  style={[input, styles.keyInput]}
                  value={entry.key}
                  onChangeText={(key) => update(index, { key })}
                  placeholder="Key"
                  placeholderTextColor={theme.textSecondary}
                />
                <TextInput
                  testID={`entry-${index}-leader`}
                  style={[input, styles.grow]}
                  value={entry.leader}
                  onChangeText={(leader) => update(index, { leader })}
                  placeholder="Led by"
                  placeholderTextColor={theme.textSecondary}
                />
              </View>
            </View>
          ))}

          <ThemedText type="smallBold" themeColor="textSecondary">
            ADD A SONG
          </ThemedText>
          <View style={styles.wrap}>
            {songs.map((song) => (
              <SmallButton
                key={song.songId}
                label={`+ ${song.title}`}
                testID={`add-${song.title}`}
                onPress={() => setEntriesState([...entries, { songId: song.songId, title: song.title, key: song.key ?? "", leader: "" }])}
              />
            ))}
          </View>

          <View style={styles.inline}>
            <SmallButton
              label="Save"
              accent
              testID="save-setlist"
              onPress={() =>
                run(async () => {
                  await rename({ setlistId, name });
                  await setEntries({
                    setlistId,
                    entries: entries.map((e) => ({ songId: e.songId, key: e.key, leader: e.leader })),
                  });
                  setMessage("Saved");
                })
              }
            />
            <SmallButton label="Make current" testID="make-current" onPress={() => run(async () => {
              await setCurrent({ groupId, setlistId });
              setMessage("This is now the Current setlist");
            })} />
            <SmallButton label="Back" testID="back" onPress={() => router.back()} />
            <View style={styles.grow} />
            <SmallButton
              label="Delete"
              testID="delete-setlist"
              onPress={() =>
                run(async () => {
                  router.back();
                  await deleteSetlist({ setlistId });
                })
              }
            />
          </View>
          {message ? (
            <ThemedText themeColor="textSecondary" testID="setlist-message">
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
  input: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, borderRadius: Spacing.three, fontSize: 16 },
  keyInput: { width: 80 },
  inline: { flexDirection: "row", alignItems: "center", gap: Spacing.two },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.two },
  grow: { flex: 1 },
  small: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, borderRadius: Spacing.three },
  entry: { gap: Spacing.two, padding: Spacing.three, borderWidth: 1, borderRadius: Spacing.three },
});
