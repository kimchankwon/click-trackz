import { useMutation, useQuery } from "convex/react";
import { router, useLocalSearchParams } from "expo-router";
import { useKeepAwake } from "expo-keep-awake";
import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { speakers, type SpeakerId } from "@/audio/builtin-voice-clips";
import { CueAudioEngine, type CueMix } from "@/audio/engine";
import { defaultSpeaker, isSpeakerId } from "@/audio/voice-clips";
import { BeatPulse } from "@/components/playback/beat-pulse";
import { VolumeBar } from "@/components/playback/volume-bar";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { MaxContentWidth, Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { errorText } from "@/lib/error-text";
import { useDeviceSetting } from "@/settings/use-device-setting";
import { beatsBetween, type Beat, type Playback, type Section, type Song } from "@/sync/timeline";
import { useServerClock } from "@/sync/use-server-clock";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";

type JumpMode = "endOfSection" | "nextBar";

const labelOf = (section: Pick<Section, "sectionType" | "number">) =>
  `${section.sectionType.toUpperCase()}${section.number ?? ""}`;

const isVolume = (value: string): value is string => /^(0(\.\d+)?|1(\.0+)?)$/.test(value);

function upcomingVoiceCue(recent: readonly Beat[]): Beat["voiceCue"] {
  const cueIndex = recent.findLastIndex((b) => b.voiceCue !== null);
  if (cueIndex === -1) return null;
  const sameBar = recent.slice(cueIndex + 1).every((b) => !b.accent);
  return sameBar ? recent[cueIndex].voiceCue : null;
}

function KeepAwake() {
  useKeepAwake();
  return null;
}

function Chip({
  label,
  selected,
  onPress,
  role = "switch",
  testID,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  role?: "switch" | "button";
  testID?: string;
}) {
  const theme = useTheme();
  return (
    <Pressable
      role={role}
      aria-checked={role === "switch" ? selected : undefined}
      testID={testID}
      onPress={onPress}
      style={[styles.chip, { backgroundColor: selected ? theme.accent : theme.backgroundElement }]}
    >
      <ThemedText type="smallBold" style={selected ? styles.onAccent : null}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

function TransportButton({ label, onPress, testID, primary }: { label: string; onPress: () => void; testID: string; primary?: boolean }) {
  const theme = useTheme();
  return (
    <Pressable
      role="button"
      testID={testID}
      onPress={onPress}
      style={[styles.transport, { backgroundColor: primary ? theme.accent : theme.backgroundElement }]}
    >
      <ThemedText type="subtitle" style={[styles.transportText, primary ? styles.onAccent : null]}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <View style={[styles.card, { borderColor: theme.backgroundSelected }]}>
      <ThemedText type="smallBold" themeColor="textSecondary">
        {title}
      </ThemedText>
      {children}
    </View>
  );
}

function MembersCard({ groupId, isAdmin, run }: { groupId: Id<"groups">; isAdmin: boolean; run: (action: () => Promise<unknown>) => void }) {
  const members = useQuery(api.groups.members, { groupId });
  const viewer = useQuery(api.users.viewer, {});
  const setRole = useMutation(api.groups.setRole);
  const theme = useTheme();
  return (
    <Card title="MEMBERS">
      {(members ?? []).map((member) => (
        <View key={member.userId} style={styles.memberRow} testID={`member-${member.displayName}`}>
          <ThemedText style={styles.memberName}>
            {member.displayName}
            {member.userId === viewer?.id ? " (you)" : ""}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {member.role === "admin" ? "Admin" : member.isGuest ? "Guest" : "Member"}
          </ThemedText>
          {isAdmin && !member.isGuest ? (
            <Pressable
              role="button"
              testID={`toggle-admin-${member.displayName}`}
              onPress={() =>
                run(() => setRole({ groupId, userId: member.userId, role: member.role === "admin" ? "member" : "admin" }))
              }
              style={[styles.smallButton, { backgroundColor: theme.backgroundElement }]}
            >
              <ThemedText type="small">{member.role === "admin" ? "Make Member" : "Make Admin"}</ThemedText>
            </Pressable>
          ) : null}
        </View>
      ))}
    </Card>
  );
}

function SongsCard({
  groupId,
  isAdmin,
  selectedSongId,
  onSelect,
  run,
}: {
  groupId: Id<"groups">;
  isAdmin: boolean;
  selectedSongId: Id<"songs"> | null;
  onSelect: (songId: Id<"songs">) => void;
  run: (action: () => Promise<unknown>) => void;
}) {
  const songs = useQuery(api.songs.list, { groupId });
  const createSong = useMutation(api.songs.createSong);
  const theme = useTheme();
  const [title, setTitle] = useState("");
  return (
    <Card title="SONGS">
      {(songs ?? []).map((song) => (
        <View key={song.songId} style={styles.memberRow}>
          <Pressable
            role={isAdmin ? "radio" : undefined}
            aria-checked={isAdmin ? selectedSongId === song.songId : undefined}
            testID={`song-${song.title}`}
            onPress={() => (isAdmin ? onSelect(song.songId) : undefined)}
            style={styles.memberName}
          >
            <ThemedText type={selectedSongId === song.songId ? "smallBold" : "default"}>
              {selectedSongId === song.songId ? "▶ " : ""}
              {song.title}
              {song.key ? ` · ${song.key}` : ""}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {song.sectionCount === 0 ? "needs structure" : `${song.sectionCount} Sections`}
            </ThemedText>
          </Pressable>
          {isAdmin ? (
            <Pressable
              role="link"
              testID={`edit-${song.title}`}
              onPress={() =>
                router.push({ pathname: "/group/[groupId]/song/[songId]", params: { groupId, songId: song.songId } })
              }
              style={[styles.smallButton, { backgroundColor: theme.backgroundElement }]}
            >
              <ThemedText type="small">Edit</ThemedText>
            </Pressable>
          ) : null}
        </View>
      ))}
      {isAdmin ? (
        <View style={styles.memberRow}>
          <TextInput
            testID="new-song-title"
            value={title}
            onChangeText={setTitle}
            placeholder="New Song title"
            placeholderTextColor={theme.textSecondary}
            style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }]}
          />
          <Pressable
            role="button"
            testID="add-song"
            onPress={() =>
              run(async () => {
                const songId = await createSong({ groupId, title });
                setTitle("");
                router.push({ pathname: "/group/[groupId]/song/[songId]", params: { groupId, songId } });
              })
            }
            style={[styles.smallButton, { backgroundColor: theme.accent }]}
          >
            <ThemedText type="small" style={styles.onAccent}>
              Add
            </ThemedText>
          </Pressable>
        </View>
      ) : null}
    </Card>
  );
}

function SetlistCard({
  groupId,
  isAdmin,
  selectedSongId,
  onSelect,
  run,
}: {
  groupId: Id<"groups">;
  isAdmin: boolean;
  selectedSongId: Id<"songs"> | null;
  onSelect: (songId: Id<"songs">) => void;
  run: (action: () => Promise<unknown>) => void;
}) {
  const setlists = useQuery(api.setlists.list, { groupId });
  const createSetlist = useMutation(api.setlists.createSetlist);
  const theme = useTheme();
  const [shownId, setShownId] = useState<Id<"setlists"> | null>(null);
  const current = setlists?.find((s) => s.isCurrent) ?? null;
  const shown = setlists?.find((s) => s.setlistId === shownId) ?? current ?? setlists?.[0] ?? null;
  const setlist = useQuery(api.setlists.get, shown ? { setlistId: shown.setlistId } : "skip");
  if (!setlists || (setlists.length === 0 && !isAdmin)) return null;
  return (
    <Card title="SETLIST">
      <View style={styles.wrap}>
        {setlists.map((option) => (
          <Chip
            key={option.setlistId}
            label={`${option.name}${option.isCurrent ? " ★" : ""}`}
            selected={shown?.setlistId === option.setlistId}
            onPress={() => setShownId(option.setlistId)}
            testID={`setlist-${option.name}`}
          />
        ))}
        {isAdmin ? (
          <Chip
            role="button"
            label="+ New"
            selected={false}
            testID="new-setlist"
            onPress={() =>
              run(async () => {
                const setlistId = await createSetlist({ groupId, name: "New Setlist" });
                router.push({ pathname: "/group/[groupId]/setlist/[setlistId]", params: { groupId, setlistId } });
              })
            }
          />
        ) : null}
      </View>
      {(setlist?.entries ?? []).map((entry, index) => (
        <Pressable
          key={`${entry.songId}-${index}`}
          role={isAdmin ? "radio" : undefined}
          aria-checked={isAdmin ? selectedSongId === entry.songId : undefined}
          testID={`setlist-entry-${index}`}
          onPress={() => (isAdmin ? onSelect(entry.songId) : undefined)}
          style={[styles.entryRow, selectedSongId === entry.songId ? { backgroundColor: theme.accentSoft } : null]}
        >
          <ThemedText type="small" themeColor="textSecondary" style={styles.entryIndex}>
            {index + 1}
          </ThemedText>
          <View style={styles.memberName}>
            <ThemedText type="smallBold">{entry.title}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {[entry.key ? `Key of ${entry.key}` : null, entry.leader ? `Led by ${entry.leader}` : null, entry.needsStructure ? "needs structure" : null]
                .filter(Boolean)
                .join(" · ")}
            </ThemedText>
          </View>
        </Pressable>
      ))}
      {isAdmin && shown ? (
        <Chip
          role="button"
          label="Edit this Setlist"
          selected={false}
          testID="edit-setlist"
          onPress={() => router.push({ pathname: "/group/[groupId]/setlist/[setlistId]", params: { groupId, setlistId: shown.setlistId } })}
        />
      ) : null}
    </Card>
  );
}

const emptySong: Song = { countIn: false, sections: [] };

export default function GroupScreen() {
  const { groupId: groupIdParam } = useLocalSearchParams<{ groupId: string }>();
  const groupId = groupIdParam as Id<"groups">;
  const { estimate, serverNow } = useServerClock();
  const playbackDoc = useQuery(api.playback.current, { groupId });
  const playback = (playbackDoc ?? null) as (Playback & { songId: Id<"songs"> }) | null;
  const [selectedSongId, setSelectedSongId] = useState<Id<"songs"> | null>(null);
  const playingSong = useQuery(api.songs.get, playback ? { songId: playback.songId } : "skip");
  const selectedSong = useQuery(api.songs.get, selectedSongId ? { songId: selectedSongId } : "skip");
  const song: Song = playingSong ?? emptySong;
  const shownSong = playback ? playingSong : selectedSong;
  const myGroups = useQuery(api.groups.myGroups, {});
  const group = myGroups?.find((g) => g.groupId === groupId);
  const isAdmin = group?.role === "admin";
  const start = useMutation(api.playback.start);
  const jump = useMutation(api.playback.jump);
  const stop = useMutation(api.playback.stop);
  const leave = useMutation(api.groups.leaveGroup);
  const engine = useRef<CueAudioEngine | null>(null);
  const [soundOn, setSoundOn] = useState(false);
  const [mix, setMix] = useState<CueMix>({ click: true, voiceCues: true, spokenCounts: true });
  const [clickVolume, setClickVolume] = useDeviceSetting("clickVolume", "0.8", isVolume);
  const [voiceVolume, setVoiceVolume] = useDeviceSetting("voiceVolume", "0.9", isVolume);
  const [speaker, setSpeaker] = useDeviceSetting<SpeakerId>("speaker", defaultSpeaker, isSpeakerId);
  const [jumpMode, setJumpMode] = useState<JumpMode>("endOfSection");
  const [beat, setBeat] = useState<Beat | null>(null);
  const [upcoming, setUpcoming] = useState<Beat["voiceCue"]>(null);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const theme = useTheme();

  useEffect(() => {
    engine.current?.setServerClock(serverNow);
  }, [serverNow]);

  useEffect(() => {
    engine.current?.setPlan(song, playingSong ? playback : null);
  }, [song, playingSong, playback, soundOn]);

  useEffect(() => {
    if (engine.current) engine.current.mix = mix;
  }, [mix, soundOn]);

  useEffect(() => {
    engine.current?.setVolumes({ click: Number(clickVolume), voice: Number(voiceVolume) });
  }, [clickVolume, voiceVolume, soundOn]);

  useEffect(() => {
    if (soundOn) void engine.current?.setSpeaker(speaker);
  }, [speaker, soundOn]);

  useEffect(() => () => engine.current?.dispose(), []);

  useEffect(() => {
    let handle = 0;
    const draw = () => {
      const now = serverNow();
      if (now !== null && playback && song.sections.length > 0) {
        const recent = beatsBetween(song, playback, now - 10_000, now + 1);
        const ahead = beatsBetween(song, playback, now, now + 60 * 60_000);
        const latest = recent.at(-1) ?? null;
        setBeat((previous) => (previous?.at === latest?.at ? previous : latest));
        setUpcoming(upcomingVoiceCue(recent));
        setPlaying(ahead.length > 0 || (recent.length > 0 && now < (playback.stopsAt ?? Infinity)));
      } else {
        setBeat(null);
        setUpcoming(null);
        setPlaying(false);
      }
      handle = requestAnimationFrame(draw);
    };
    handle = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(handle);
  }, [serverNow, playback, song]);

  const run = useCallback((action: () => Promise<unknown>) => {
    setError(null);
    action().catch((e: unknown) => setError(errorText(e)));
  }, []);

  const enableSound = () =>
    run(async () => {
      engine.current ??= new CueAudioEngine();
      await engine.current.enable(serverNow, speaker);
      setSoundOn(true);
    });

  const chooseSpeaker = (next: SpeakerId) => {
    setSpeaker(next);
    void engine.current?.setSpeaker(next).then(() => engine.current?.preview("chorus"));
  };

  const currentSection = playing && beat ? (beat.sectionIndex === null ? "COUNT-IN" : labelOf(song.sections[beat.sectionIndex])) : "READY";

  return (
    <ThemedView style={styles.container}>
      {playing ? <KeepAwake /> : null}
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.header}>
            <View>
              <ThemedText type="smallBold" testID="group-name">
                {group?.name ?? ""}
              </ThemedText>
              {group?.joinCode ? (
                <ThemedText type="small" themeColor="textSecondary" testID="join-code">
                  Join code {group.joinCode}
                </ThemedText>
              ) : null}
            </View>
            <View style={[styles.pill, { backgroundColor: theme.backgroundElement }]}>
              <View style={[styles.statusDot, { backgroundColor: estimate ? theme.accent : theme.textSecondary }]} />
              <ThemedText type="small" themeColor="textSecondary" testID="clock-status">
                {estimate ? `clock ±${estimate.uncertaintyMs.toFixed(0)} ms` : "Measuring clock…"}
              </ThemedText>
            </View>
          </View>

          <ThemedText type="smallBold" themeColor="textSecondary" testID="current-section">
            {currentSection}
          </ThemedText>
          <BeatPulse beat={beat} playing={playing} />
          <ThemedText type="subtitle" testID="playback-next" style={{ color: theme.accent }}>
            {playing && upcoming ? `next: ${labelOf(upcoming)}` : " "}
          </ThemedText>

          {isAdmin ? (
            <View style={styles.row}>
              <TransportButton
                label="Start"
                testID="start"
                primary
                onPress={() =>
                  run(async () => {
                    const songId = selectedSongId ?? playback?.songId;
                    if (!songId) throw new Error("Pick a Song first");
                    await start({ groupId, songId });
                  })
                }
              />
              <TransportButton label="Stop" testID="stop" onPress={() => run(() => stop({ groupId }))} />
            </View>
          ) : (
            <ThemedText type="small" themeColor="textSecondary">
              An Admin starts and steers Playback.
            </ThemedText>
          )}

          <ThemedText type="smallBold" testID="song-title">
            {shownSong?.title ?? (isAdmin ? "Pick a Song below" : "Waiting for an Admin to start a Song")}
          </ThemedText>

          <Card title="SECTIONS">
            <View style={styles.wrap}>
              {(shownSong?.sections ?? []).map((section, index) => (
                <Chip
                  key={index}
                  role="button"
                  label={labelOf(section)}
                  selected={playing && beat?.sectionIndex === index}
                  onPress={() => (isAdmin ? run(() => jump({ groupId, toSection: index, mode: jumpMode })) : undefined)}
                />
              ))}
            </View>
            <View style={[styles.wrap, isAdmin ? null : styles.hidden]}>
              <ThemedText type="small" themeColor="textSecondary">
                Jump at
              </ThemedText>
              <Chip label="End of Section" selected={jumpMode === "endOfSection"} onPress={() => setJumpMode("endOfSection")} />
              <Chip label="Next bar" selected={jumpMode === "nextBar"} onPress={() => setJumpMode("nextBar")} />
            </View>
          </Card>

          <Card title="SOUND">
            {soundOn ? (
              <>
                <VolumeBar
                  label="Click"
                  testID="click-volume"
                  value={Number(clickVolume)}
                  onChange={(next) => setClickVolume(next.toFixed(2))}
                />
                <VolumeBar
                  label="Voice"
                  testID="voice-volume"
                  value={Number(voiceVolume)}
                  onChange={(next) => setVoiceVolume(next.toFixed(2))}
                />
                <View style={styles.wrap}>
                  <Chip label="Click" selected={mix.click} onPress={() => setMix({ ...mix, click: !mix.click })} />
                  <Chip label="Voice cues" selected={mix.voiceCues} onPress={() => setMix({ ...mix, voiceCues: !mix.voiceCues })} />
                  <Chip
                    label="Spoken counts"
                    selected={mix.spokenCounts}
                    onPress={() => setMix({ ...mix, spokenCounts: !mix.spokenCounts })}
                  />
                </View>
              </>
            ) : (
              <TransportButton label="Enable sound" testID="enable-sound" primary onPress={enableSound} />
            )}
            <View style={styles.wrap} testID="speaker-picker">
              <ThemedText type="small" themeColor="textSecondary">
                Speaker
              </ThemedText>
              {speakers.map((option) => (
                <Chip key={option.id} label={option.name} selected={speaker === option.id} onPress={() => chooseSpeaker(option.id)} />
              ))}
            </View>
          </Card>
          <SetlistCard
            groupId={groupId}
            isAdmin={isAdmin}
            selectedSongId={selectedSongId ?? playback?.songId ?? null}
            onSelect={setSelectedSongId}
            run={run}
          />
          <SongsCard
            groupId={groupId}
            isAdmin={isAdmin}
            selectedSongId={selectedSongId ?? playback?.songId ?? null}
            onSelect={setSelectedSongId}
            run={run}
          />
          <MembersCard groupId={groupId} isAdmin={isAdmin} run={run} />
          <Pressable
            role="button"
            testID="leave-group"
            onPress={() =>
              run(async () => {
                router.replace("/");
                await leave({ groupId });
              })
            }
          >
            <ThemedText type="small" themeColor="textSecondary">
              Leave Group
            </ThemedText>
          </Pressable>
          {error ? (
            <ThemedText themeColor="textSecondary" testID="error">
              {error}
            </ThemedText>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  content: {
    alignItems: "center",
    gap: Spacing.three,
    padding: Spacing.four,
    maxWidth: MaxContentWidth,
    alignSelf: "center",
    width: "100%",
  },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", width: "100%" },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    borderRadius: Spacing.five,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  row: { flexDirection: "row", gap: Spacing.three, width: "100%" },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.two, alignItems: "center" },
  transport: { flex: 1, alignItems: "center", paddingVertical: Spacing.three, borderRadius: Spacing.four },
  transportText: { fontSize: 22, lineHeight: 28 },
  onAccent: { color: "#FFFFFF" },
  chip: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, borderRadius: Spacing.five },
  hidden: { display: "none" },
  entryRow: { flexDirection: "row", alignItems: "center", gap: Spacing.three, padding: Spacing.two, borderRadius: Spacing.three },
  entryIndex: { width: 20, textAlign: "right" },
  input: { flex: 1, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, borderRadius: Spacing.three, fontSize: 16 },
  memberRow: { flexDirection: "row", alignItems: "center", gap: Spacing.three },
  memberName: { flex: 1 },
  smallButton: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.one, borderRadius: Spacing.three },
  card: { width: "100%", gap: Spacing.three, padding: Spacing.three, borderWidth: 1, borderRadius: Spacing.four },
});
