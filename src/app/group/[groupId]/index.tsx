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
import { ActionButton } from "@/components/action-button";
import { BeatPulse, type IdleReadout } from "@/components/playback/beat-pulse";
import { Card, Divider } from "@/components/group/card";
import { Chip } from "@/components/group/chip";
import { MembersCard } from "@/components/group/members-card";
import { SetlistCard } from "@/components/group/setlist-card";
import { SongsCard } from "@/components/group/songs-card";
import { TabBar, type GroupTab } from "@/components/group/tab-bar";
import { VoicePackCard } from "@/components/group/voice-pack-card";
import { VolumeBar } from "@/components/playback/volume-bar";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Icon } from "@/components/ui/icon";
import { ScreenHeader } from "@/components/ui/screen-header";
import { Segmented } from "@/components/ui/segmented";
import { Switch } from "@/components/ui/switch";
import { Fonts, MaxContentWidth, Radius, Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { errorText } from "@/lib/error-text";
import { isLatencySetting } from "@/settings/latency";
import { useDeviceSetting } from "@/settings/use-device-setting";
import { beatsBetween, type Beat, type Playback, type Section, type Song } from "@/sync/timeline";
import { useServerClock } from "@/sync/use-server-clock";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";

type JumpMode = "endOfSection" | "nextBar";

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

const titleOf = (section: Pick<Section, "sectionType" | "number">) =>
  `${section.sectionType}${section.number ? ` ${section.number}` : ""}`;

type LoadedSong = { title: string; key: string | null; tempoHint: { bpm: number; beatsPerBar: number } | null; sections: Section[] };

function idleReadoutFor(song: LoadedSong | null | undefined): IdleReadout | null {
  if (!song) return null;
  const first = song.sections[0];
  const bpm = first?.bpm ?? song.tempoHint?.bpm;
  const beatsPerBar = first?.beatsPerBar ?? song.tempoHint?.beatsPerBar;
  const detail = [beatsPerBar ? `${beatsPerBar}/4` : null, song.key ? `Key of ${song.key}` : null].filter(Boolean).join(" · ");
  return bpm ? { value: String(Math.round(bpm)), unit: "BPM", detail: detail || undefined } : { value: "--", unit: "No Sections yet" };
}

const emptySong: Song = { countIn: false, sections: [] };

const MIX_TEXT_INSET = 38;
const WEAK_PING_MS = 80;
const BAD_PING_MS = 150;

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
  const [playing, setPlaying] = useState(false);
  const { estimate, serverNow } = useServerClock({ playing });
  const playbackDoc = useQuery(api.playback.current, { groupId });
  const playback = (playbackDoc ?? null) as (Playback & { songId: Id<"songs">; song: Song }) | null;
  const [selectedSongId, setSelectedSongId] = useState<Id<"songs"> | null>(null);
  const playingSong = useQuery(api.songs.get, playback ? { songId: playback.songId } : "skip");
  const selectedSong = useQuery(api.songs.get, selectedSongId ? { songId: selectedSongId } : "skip");
  const song: Song = playback?.song ?? emptySong;
  const showPlayback = playback !== null && (playing || selectedSongId === null);
  const shownTitle = showPlayback ? playingSong?.title : selectedSong?.title;
  const shownSections = showPlayback ? playback.song.sections : (selectedSong?.sections ?? []);
  const isAdmin = group.role === "admin";
  const startSongId = selectedSongId ?? playback?.songId ?? null;
  const startSong = selectedSongId ? selectedSong : playingSong;
  const startBlocker: "noSong" | "needsSections" | "loading" | null =
    startSongId === null ? "noSong" : startSong === undefined ? "loading" : startSong === null || startSong.sections.length === 0 ? "needsSections" : null;
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
  const [tab, setTab] = useState<GroupTab>("play");
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
  const currentSection = !playing || !beat ? "Ready" : beat.sectionIndex === null ? "Count-in" : beatSection ? titleOf(beatSection) : "Ready";
  const idle = idleReadoutFor(startSong);
  const followingSection = playing && beat ? song.sections[beat.sectionIndex === null ? 0 : beat.sectionIndex + 1] : undefined;
  const nextLine = !playing ? null : upcoming ? titleOf(upcoming) : followingSection ? titleOf(followingSection) : "End of Song";
  const startHint =
    startBlocker === "noSong"
      ? "Pick a Song to start"
      : startBlocker === "needsSections"
        ? "Add Sections before this Song can start"
        : null;

  const startPlayback = () =>
    run(async () => {
      if (startSongId) await start({ groupId, songId: startSongId });
    });

  const header = (
    <ScreenHeader
      title={group.name}
      subtitle={group.joinCode ? `Join code ${group.joinCode}` : isAdmin ? "Admin" : "Member"}
      onBack={() => router.replace("/")}
      backLabel="Your Groups"
      backTestID="groups-back"
      right={
        <View style={styles.pill}>
          <Icon
            name="ping"
            size={12}
            color={!estimate ? "textTertiary" : estimate.roundTripMs > BAD_PING_MS ? "danger" : estimate.roundTripMs > WEAK_PING_MS ? "warning" : "success"}
          />
          <ThemedText type="caption" themeColor="textTertiary" testID="clock-status" style={styles.pillText}>
            {estimate ? `Ping ${Math.round(estimate.roundTripMs)} ms${estimate.roundTripMs > WEAK_PING_MS ? " · weak" : ""}` : "Measuring…"}
          </ThemedText>
        </View>
      }
    />
  );

  const soundPrompt = soundOn ? null : (
    <View style={[styles.soundPrompt, { backgroundColor: theme.accentTint }]}>
      <Icon name="sound" size={20} color="accent" />
      <ThemedText type="smallBold" style={styles.grow}>
        Sound is off on this phone
      </ThemedText>
      <ActionButton small accent label="Enable" testID="enable-sound" onPress={enableSound} />
    </View>
  );

  const playTab = (
    <>
      {soundPrompt}
      {playing ? (
        <View style={[styles.stageHead, styles.titleBlock]}>
          <ThemedText testID="song-title" themeColor="textSecondary" style={[styles.centered, styles.playingSong]} numberOfLines={1}>
            {shownTitle ?? " "}
          </ThemedText>
          <ThemedText type="title" testID="current-section" style={[styles.centered, styles.sectionHeading]}>
            {currentSection}
          </ThemedText>
        </View>
      ) : (
        <View style={[styles.stageHead, styles.titleBlock]}>
          <View style={[styles.statusPill, { backgroundColor: startBlocker === null ? theme.successTint : theme.backgroundElement }]}>
            <ThemedText testID="current-section" themeColor={startBlocker === null ? "success" : "textSecondary"} style={styles.statusText}>
              {startBlocker === null ? "Ready" : startBlocker === "noSong" ? "No Song picked" : startBlocker === "loading" ? "Loading" : "Needs Sections"}
            </ThemedText>
          </View>
          <ThemedText type="title" testID="song-title" style={[styles.centered, styles.idleTitle]} numberOfLines={2}>
            {shownTitle ?? (isAdmin ? "Pick a Song" : "Waiting for an Admin")}
          </ThemedText>
          {!isAdmin ? (
            <ThemedText type="small" themeColor="textSecondary" style={styles.centered}>
              An Admin starts and steers Playback.
            </ThemedText>
          ) : null}
          {isAdmin && startBlocker === "needsSections" && startSongId ? (
            <Pressable
              role="link"
              testID="start-needs-sections"
              onPress={() => router.push({ pathname: "/group/[groupId]/song/[songId]", params: { groupId, songId: startSongId } })}
              style={styles.inlineLink}
            >
              <ThemedText type="smallBold" themeColor="accent">
                Add Sections to this Song
              </ThemedText>
              <Icon name="forward" size={18} color="accent" />
            </Pressable>
          ) : null}
        </View>
      )}
      <BeatPulse beat={beat} playing={playing} idle={idle} />
      {nextLine ? (
        <View style={styles.nextBlock}>
          <ThemedText themeColor="textSecondary" style={styles.nextLabel}>
            {upcoming ? "Next, in one bar" : "Next"}
          </ThemedText>
          <View style={styles.nextRow}>
            <Icon name="next" size={24} color="accent" />
            <ThemedText testID="playback-next" themeColor={upcoming ? "accent" : "text"} style={styles.nextText}>
              {nextLine}
            </ThemedText>
          </View>
        </View>
      ) : null}
      {shownSections.length > 0 ? (
        <Card title="Sections">
          <View style={styles.wrap}>
            {shownSections.map((section, index) => (
              <Chip
                key={index}
                role="button"
                strong
                label={titleOf(section)}
                selected={playing && beat?.sectionIndex === index}
                onPress={() => (isAdmin ? run(() => jump({ groupId, toSection: index, mode: jumpMode })) : undefined)}
              />
            ))}
          </View>
          {isAdmin ? (
            <>
              <View style={styles.jumpMode}>
                <ThemedText type="caption" themeColor="textTertiary">
                  When I tap a Section, go
                </ThemedText>
                <Segmented
                  compact
                  label="When I tap a Section, go"
                  value={jumpMode}
                  onChange={setJumpMode}
                  options={[
                    { value: "endOfSection", label: "After this Section" },
                    { value: "nextBar", label: "At the next bar" },
                  ]}
                />
              </View>
            </>
          ) : null}
        </Card>
      ) : null}
    </>
  );

  const songsTab = (
    <>
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
    </>
  );

  const soundTab = (
    <>
      {soundPrompt}
      {soundOn ? (
        <Card title="Mix">
          <View style={styles.mixRow}>
            <View style={styles.mixHead}>
              <Icon name="metronome" size={22} color="textSecondary" />
              <View style={styles.grow}>
                <Switch label="Click" value={mix.click} onChange={(on) => setMix({ ...mix, click: on })} />
              </View>
            </View>
            <View style={styles.mixSlider}>
              <VolumeBar label="Click" bare testID="click-volume" value={Number(clickVolume)} onChange={(next) => setClickVolume(next.toFixed(2))} />
            </View>
          </View>
          <Divider inset={MIX_TEXT_INSET} />
          <View style={styles.mixRow}>
            <View style={styles.mixHead}>
              <Icon name="speaking" size={22} color="textSecondary" />
              <View style={styles.grow}>
                <Switch label="Voice cues" value={mix.voiceCues} onChange={(on) => setMix({ ...mix, voiceCues: on })} />
              </View>
            </View>
            <View style={styles.mixSlider}>
              <VolumeBar label="Voice" bare testID="voice-volume" value={Number(voiceVolume)} onChange={(next) => setVoiceVolume(next.toFixed(2))} />
            </View>
          </View>
          <Divider inset={MIX_TEXT_INSET} />
          <View style={styles.mixHead}>
            <Icon name="counter" size={22} color="textSecondary" />
            <View style={styles.grow}>
              <Switch label="Spoken counts" hint="Uses the Voice volume" value={mix.spokenCounts} onChange={(on) => setMix({ ...mix, spokenCounts: on })} />
            </View>
          </View>
        </Card>
      ) : null}
      <Card title="Speaker" plain>
        <Segmented
          label="Speaker"
          testID="speaker-picker"
          value={speaker}
          onChange={chooseSpeaker}
          options={speakers.map((option) => ({ value: option.id, label: option.name }))}
        />
        {soundOn ? null : (
          <ThemedText type="caption" themeColor="textSecondary" testID="speaker-preview-hint" style={styles.plainHint}>
            Enable sound to hear each Speaker as you choose.
          </ThemedText>
        )}
      </Card>
      <Card title="Timing" tight>
        <Pressable role="link" testID="open-latency" onPress={() => router.push("/latency")} style={styles.linkRow}>
          <Icon name="headphones" size={22} color="textSecondary" />
          <View style={styles.grow}>
            <ThemedText type="smallBold">Latency nudge</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              For Bluetooth audio
            </ThemedText>
          </View>
          <ThemedText themeColor="textSecondary" style={styles.latencyValue}>
            {latencyNudge} ms
          </ThemedText>
          <Icon name="forward" size={20} color="textTertiary" />
        </Pressable>
      </Card>
      {clickVolumeUnsaved || voiceVolumeUnsaved || speakerUnsaved ? (
        <ThemedText type="caption" themeColor="textSecondary" testID="setting-unsaved">
          This device could not save your choice, so it will reset when you reopen the app.
        </ThemedText>
      ) : null}
    </>
  );

  const groupTab = (
    <>
      <MembersCard groupId={groupId} isAdmin={isAdmin} run={run} />
      {isAdmin ? <VoicePackCard groupId={groupId} run={run} canPreview={soundOn} onPreview={(key) => engine.current?.previewUpload(key)} /> : null}
      <View style={styles.leave}>
        <ActionButton
          variant="danger"
          icon="logout"
          label="Leave Group"
          testID="leave-group"
          onPress={() =>
            run(async () => {
              await leave({ groupId });
              router.replace("/");
            })
          }
        />
      </View>
    </>
  );

  return (
    <ThemedView style={styles.container}>
      {playing ? <KeepAwake /> : null}
      <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
        <ScrollView contentContainerStyle={styles.content}>
          {header}
          {tab === "play" ? playTab : tab === "songs" ? songsTab : tab === "sound" ? soundTab : groupTab}
          {error ? (
            <ThemedText type="small" themeColor="danger" testID="error" style={styles.centered}>
              {error}
            </ThemedText>
          ) : null}
        </ScrollView>
        <View style={[styles.dock, { backgroundColor: theme.background, borderTopColor: theme.border }]}>
          {isAdmin && tab === "play" ? (
            <View style={styles.transport}>
              {playing ? (
                <ActionButton large full variant="stop" icon="stop" label="Stop" testID="stop" onPress={() => run(() => stop({ groupId }))} />
              ) : (
                <ActionButton
                  large
                  full
                  accent
                  icon="play"
                  label={startHint ?? (startSong ? `Start ${startSong.title}` : "Start")}
                  accessibleName="Start"
                  testID="start"
                  disabled={startBlocker !== null}
                  onPress={startPlayback}
                />
              )}
            </View>
          ) : null}
          {isAdmin && tab !== "play" ? (
            <View style={[styles.miniBar, { backgroundColor: theme.backgroundElement }]}>
              <Icon name={playing ? "pulse" : "songs"} size={20} color={playing ? "accent" : "textSecondary"} />
              <View style={styles.grow}>
                <ThemedText numberOfLines={1} style={styles.miniTitle}>
                  {shownTitle ?? "No Song picked"}
                </ThemedText>
                <ThemedText type="caption" themeColor="textSecondary" numberOfLines={1}>
                  {playing ? currentSection : (startHint ?? "Ready to start")}
                </ThemedText>
              </View>
              {playing ? (
                <ActionButton medium rounded variant="stop" icon="stop" label="Stop" testID="stop" onPress={() => run(() => stop({ groupId }))} />
              ) : (
                <ActionButton medium rounded accent icon="play" label="Start" testID="start" disabled={startBlocker !== null} onPress={startPlayback} />
              )}
            </View>
          ) : null}
          <TabBar active={tab} onChange={setTab} />
        </View>
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
    gap: Spacing.four,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.five,
    maxWidth: MaxContentWidth,
    alignSelf: "center",
    width: "100%",
  },
  pill: { flexDirection: "row", alignItems: "center", gap: Spacing.one + 2, height: 28 },
  pillText: { fontSize: 13, fontWeight: 500, fontVariant: ["tabular-nums"] },
  stageHead: { alignItems: "center", gap: Spacing.one, width: "100%" },
  sectionHeading: { fontSize: 52, lineHeight: 58 },
  playingSong: { fontSize: 15, lineHeight: 20, fontWeight: 600 },
  idleTitle: { fontSize: 40, lineHeight: 46 },
  statusPill: { paddingHorizontal: 12, height: 28, borderRadius: Radius.pill, justifyContent: "center" },
  statusText: { fontSize: 13, lineHeight: 18, fontWeight: 600, letterSpacing: 0.8, textTransform: "uppercase" },
  titleBlock: { minHeight: 104, justifyContent: "center" },
  nextBlock: { alignItems: "center", gap: Spacing.one },
  nextLabel: { fontSize: 13, lineHeight: 16, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" },
  nextRow: { flexDirection: "row", alignItems: "center", gap: Spacing.two, minHeight: 32 },
  nextText: { fontFamily: Fonts.display, fontSize: 26, lineHeight: 32, fontWeight: 700 },
  mixSlider: { paddingLeft: MIX_TEXT_INSET },
  mixRow: { gap: Spacing.one },
  mixHead: { flexDirection: "row", alignItems: "center", gap: Spacing.three },
  plainHint: { paddingHorizontal: Spacing.one },
  latencyValue: { fontSize: 17, fontWeight: 600, fontVariant: ["tabular-nums"], marginRight: Spacing.two },
  miniTitle: { fontSize: 15, lineHeight: 20, fontWeight: 600 },
  soundPrompt: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.three,
    paddingLeft: Spacing.three,
    paddingRight: Spacing.two,
    minHeight: 52,
    borderRadius: Radius.md,
    width: "100%",
  },
  leave: { width: "100%", paddingTop: Spacing.two, alignItems: "center" },
  switches: { gap: Spacing.three },
  miniBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.three,
    marginTop: 12,
    minHeight: 60,
    paddingVertical: Spacing.two,
    paddingHorizontal: 14,
    borderRadius: Radius.lg,
    maxWidth: MaxContentWidth,
    width: "100%",
    alignSelf: "center",
  },
  grow: { flex: 1, minWidth: 0 },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 12, alignItems: "center" },
  jumpMode: { gap: Spacing.two, paddingTop: Spacing.two },
  linkRow: { flexDirection: "row", alignItems: "center", gap: Spacing.three, minHeight: 64, paddingVertical: Spacing.one },
  inlineLink: { flexDirection: "row", alignItems: "center", gap: Spacing.one, minHeight: 44 },
  tabular: { fontVariant: ["tabular-nums"] },
  centered: { textAlign: "center" },
  dock: { paddingHorizontal: Spacing.four, borderTopWidth: StyleSheet.hairlineWidth },
  transport: { flexDirection: "row", paddingTop: 12, paddingBottom: Spacing.one, maxWidth: MaxContentWidth, width: "100%", alignSelf: "center" },
  backButton: { paddingHorizontal: Spacing.four, paddingVertical: Spacing.three, borderRadius: Radius.md },
});
