import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { router, useLocalSearchParams } from "expo-router";
import { useKeepAwake } from "expo-keep-awake";
import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { speakers, type SpeakerId } from "@/audio/builtin-voice-clips";
import { CueAudioEngine, type CueMix } from "@/audio/engine";
import { defaultSpeaker, isSpeakerId } from "@/audio/voice-clips";
import { BeatPulse } from "@/components/playback/beat-pulse";
import { Card } from "@/components/group/card";
import { Chip } from "@/components/group/chip";
import { MembersCard } from "@/components/group/members-card";
import { SetlistCard } from "@/components/group/setlist-card";
import { SongsCard } from "@/components/group/songs-card";
import { VoicePackCard } from "@/components/group/voice-pack-card";
import { VolumeBar } from "@/components/playback/volume-bar";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { MaxContentWidth, Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { errorText } from "@/lib/error-text";
import { isLatencySetting } from "@/settings/latency";
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

const sameVoiceCue = (a: Beat["voiceCue"], b: Beat["voiceCue"]) =>
  a === b || (a !== null && b !== null && a.sectionType === b.sectionType && a.number === b.number);

function KeepAwake() {
  useKeepAwake();
  return null;
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
      <ThemedText type="subtitle" style={[styles.transportText, primary ? { color: theme.onAccent } : null]}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

const emptySong: Song = { countIn: false, sections: [] };

type MyGroup = FunctionReturnType<typeof api.groups.myGroups>[number];

export default function GroupRoute() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const myGroups = useQuery(api.groups.myGroups, {});
  const theme = useTheme();
  if (myGroups === undefined) return <ThemedView style={styles.container} />;
  const group = myGroups.find((g) => g.groupId === groupId);
  if (group) return <GroupScreen group={group} />;
  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.notInGroup}>
        <ThemedText type="subtitle">You are not in this Group</ThemedText>
        <ThemedText themeColor="textSecondary" testID="not-in-group">
          Ask an Admin for its join code, or open one of your Groups.
        </ThemedText>
        <Pressable
          role="button"
          testID="back-to-groups"
          onPress={() => router.replace("/")}
          style={[styles.backButton, { backgroundColor: theme.accent }]}
        >
          <ThemedText style={{ color: theme.onAccent }}>Back to your Groups</ThemedText>
        </Pressable>
      </SafeAreaView>
    </ThemedView>
  );
}

function GroupScreen({ group }: { group: MyGroup }) {
  const groupId = group.groupId;
  const { estimate, serverNow } = useServerClock();
  const playbackDoc = useQuery(api.playback.current, { groupId });
  const playback = (playbackDoc ?? null) as (Playback & { songId: Id<"songs">; song: Song }) | null;
  const [selectedSongId, setSelectedSongId] = useState<Id<"songs"> | null>(null);
  const playingSong = useQuery(api.songs.get, playback ? { songId: playback.songId } : "skip");
  const selectedSong = useQuery(api.songs.get, selectedSongId ? { songId: selectedSongId } : "skip");
  const song: Song = playback?.song ?? emptySong;
  const [playing, setPlaying] = useState(false);
  const showPlayback = playback !== null && (playing || selectedSongId === null);
  const shownTitle = showPlayback ? playingSong?.title : selectedSong?.title;
  const shownSections = showPlayback ? playback.song.sections : (selectedSong?.sections ?? []);
  const isAdmin = group.role === "admin";
  const start = useMutation(api.playback.start);
  const jump = useMutation(api.playback.jump);
  const stop = useMutation(api.playback.stop);
  const leave = useMutation(api.groups.leaveGroup);
  const recordings = useQuery(api.recordings.list, { groupId });
  const engine = useRef<CueAudioEngine | null>(null);
  const [soundOn, setSoundOn] = useState(false);
  const [mix, setMix] = useState<CueMix>({ click: true, voiceCues: true, spokenCounts: true });
  const [clickVolume, setClickVolume, clickVolumeUnsaved] = useDeviceSetting("clickVolume", "0.8", isVolume);
  const [voiceVolume, setVoiceVolume, voiceVolumeUnsaved] = useDeviceSetting("voiceVolume", "0.9", isVolume);
  const [speaker, setSpeaker, speakerUnsaved] = useDeviceSetting<SpeakerId>("speaker", defaultSpeaker, isSpeakerId);
  const [latencyNudge] = useDeviceSetting("latencyNudgeMs", "0", isLatencySetting);
  const [jumpMode, setJumpMode] = useState<JumpMode>("endOfSection");
  const [beat, setBeat] = useState<Beat | null>(null);
  const [upcoming, setUpcoming] = useState<Beat["voiceCue"]>(null);
  const [error, setError] = useState<string | null>(null);
  const theme = useTheme();

  useEffect(() => {
    engine.current?.setServerClock(serverNow);
  }, [serverNow]);

  useEffect(() => {
    engine.current?.setPlan(song, song.sections.length > 0 ? playback : null);
  }, [song, playback, soundOn]);

  useEffect(() => {
    if (engine.current) engine.current.mix = mix;
  }, [mix, soundOn]);

  useEffect(() => {
    engine.current?.setVolumes({ click: Number(clickVolume), voice: Number(voiceVolume) });
  }, [clickVolume, voiceVolume, soundOn]);

  useEffect(() => {
    if (engine.current) engine.current.latencyNudgeMs = Number(latencyNudge);
  }, [latencyNudge, soundOn]);

  useEffect(() => {
    if (!soundOn) return;
    engine.current?.setSpeaker(speaker).catch((e: unknown) => setError(errorText(e)));
  }, [speaker, soundOn]);

  useEffect(() => {
    if (soundOn && recordings) void engine.current?.setUploads(recordings);
  }, [recordings, soundOn]);

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
        const nextCue = upcomingVoiceCue(recent);
        setUpcoming((previous) => (sameVoiceCue(previous, nextCue) ? previous : nextCue));
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
      if (!engine.current) engine.current = new CueAudioEngine();
      await engine.current.enable(serverNow, speaker);
      setSoundOn(true);
    });

  const chooseSpeaker = (next: SpeakerId) => {
    setSpeaker(next);
    const current = engine.current;
    if (!current?.enabled) return;
    run(async () => {
      await current.setSpeaker(next);
      current.preview("chorus");
    });
  };

  const beatSection = beat?.sectionIndex == null ? undefined : song.sections[beat.sectionIndex];
  const currentSection = !playing || !beat ? "READY" : beat.sectionIndex === null ? "COUNT-IN" : beatSection ? labelOf(beatSection) : "READY";

  return (
    <ThemedView style={styles.container}>
      {playing ? <KeepAwake /> : null}
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.header}>
            <View>
              <ThemedText type="smallBold" testID="group-name">
                {group.name}
              </ThemedText>
              {group.joinCode ? (
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
            {shownTitle ?? (isAdmin ? "Pick a Song below" : "Waiting for an Admin to start a Song")}
          </ThemedText>

          <Card title="SECTIONS">
            <View style={styles.wrap}>
              {shownSections.map((section, index) => (
                <Chip
                  key={index}
                  role="button"
                  label={labelOf(section)}
                  selected={playing && beat?.sectionIndex === index}
                  onPress={() => (isAdmin ? run(() => jump({ groupId, toSection: index, mode: jumpMode })) : undefined)}
                />
              ))}
            </View>
            <View style={[styles.wrap, isAdmin ? null : styles.hidden]} role="radiogroup" aria-label="Jump at">
              <ThemedText type="small" themeColor="textSecondary">
                Jump at
              </ThemedText>
              <Chip role="radio" label="End of Section" selected={jumpMode === "endOfSection"} onPress={() => setJumpMode("endOfSection")} />
              <Chip role="radio" label="Next bar" selected={jumpMode === "nextBar"} onPress={() => setJumpMode("nextBar")} />
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
            <Pressable role="link" testID="open-latency" onPress={() => router.push("/latency")}>
              <ThemedText type="small" themeColor="textSecondary">
                Latency nudge {latencyNudge} ms · Adjust
              </ThemedText>
            </Pressable>
            <View style={styles.wrap} testID="speaker-picker" role="radiogroup" aria-label="Speaker">
              <ThemedText type="small" themeColor="textSecondary">
                Speaker
              </ThemedText>
              {speakers.map((option) => (
                <Chip key={option.id} role="radio" label={option.name} selected={speaker === option.id} onPress={() => chooseSpeaker(option.id)} />
              ))}
            </View>
            {soundOn ? null : (
              <ThemedText type="small" themeColor="textSecondary" testID="speaker-preview-hint">
                Enable sound to hear each Speaker as you choose.
              </ThemedText>
            )}
            {clickVolumeUnsaved || voiceVolumeUnsaved || speakerUnsaved ? (
              <ThemedText type="small" themeColor="textSecondary" testID="setting-unsaved">
                This device could not save your choice, so it will reset when you reopen the app.
              </ThemedText>
            ) : null}
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
          {isAdmin ? <VoicePackCard groupId={groupId} run={run} canPreview={soundOn} onPreview={(key) => engine.current?.previewUpload(key)} /> : null}
          <MembersCard groupId={groupId} isAdmin={isAdmin} run={run} />
          <Pressable
            role="button"
            testID="leave-group"
            onPress={() =>
              run(async () => {
                await leave({ groupId });
                router.replace("/");
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
  notInGroup: { flex: 1, justifyContent: "center", alignItems: "center", gap: Spacing.three, padding: Spacing.four },
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
  hidden: { display: "none" },
  backButton: { paddingHorizontal: Spacing.four, paddingVertical: Spacing.three, borderRadius: Spacing.three },
});
