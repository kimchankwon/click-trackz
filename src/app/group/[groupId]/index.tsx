import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { router, useLocalSearchParams, usePreventRemove } from "expo-router";
import { useKeepAwake } from "expo-keep-awake";
import { useCallback, useEffect, useRef, useState, type ComponentRef } from "react";
import { AppState, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { describeAudioError } from "@/audio/audio-failure";
import { speakers, type SpeakerId } from "@/audio/builtin-voice-clips";
import { CueAudioEngine, type CueMix } from "@/audio/engine";
import { onUserGesture } from "@/audio/user-gesture";
import { defaultSpeaker, isSpeakerId } from "@/audio/voice-clips";
import { ActionButton } from "@/components/action-button";
import { BeatPulse, type IdleReadout } from "@/components/playback/beat-pulse";
import { SectionProgress } from "@/components/playback/section-progress";
import { StageMembers, type StageMember } from "@/components/playback/stage-members";
import { Card, Divider } from "@/components/group/card";
import { Chip } from "@/components/group/chip";
import { MembersCard } from "@/components/group/members-card";
import { SetlistCard } from "@/components/group/setlist-card";
import { SongsCard } from "@/components/group/songs-card";
import { panelId, TabBar, tabId, type GroupTab } from "@/components/group/tab-bar";
import { VoicePackCard } from "@/components/group/voice-pack-card";
import { VolumeBar } from "@/components/playback/volume-bar";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Icon } from "@/components/ui/icon";
import { IconButton } from "@/components/ui/icon-button";
import { MetronomeIcon } from "@/components/ui/metronome-icon";
import { ScreenHeader } from "@/components/ui/screen-header";
import { Segmented } from "@/components/ui/segmented";
import { AccentPicker } from "@/components/ui/accent-picker";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Toast, useToast } from "@/components/ui/toast";
import { AudioDebug } from "@/components/audio-debug";
import { JoinCodeActions } from "@/components/group/join-code-actions";
import { SignalBars } from "@/components/ui/signal-bars";
import { Switch } from "@/components/ui/switch";
import { useDockInset } from "@/components/ui/use-dock-inset";
import { ControlHeight, Fonts, MaxContentWidth, Radius, Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { errorText } from "@/lib/error-text";
import { neighbourSong } from "@/lib/song-order";
import { countOnPlay, memberPresence, otherMemberPing } from "@/presence/online";
import { useHeartbeat, usePresence } from "@/presence/use-presence";
import { isLatencySetting } from "@/settings/latency";
import { useDeviceSetting } from "@/settings/use-device-setting";
import { beatsBetween, playbackEndsAt, timeSignatureOf, type Beat, type Playback, type Section, type Song } from "@/sync/timeline";
import { nextSectionIndex } from "@/sync/next-section";
import { WEAK_PING_MS } from "@/sync/ping-quality";
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

function ScreenWakeLock() {
  useKeepAwake(undefined, { suppressDeactivateWarnings: true });
  return null;
}

function KeepAwake() {
  const [returns, setReturns] = useState(0);
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") setReturns((count) => count + 1);
    });
    return () => subscription.remove();
  }, []);
  return <ScreenWakeLock key={returns} />;
}

const titleOf = (section: Pick<Section, "sectionType" | "number">) =>
  `${section.sectionType}${section.number ? ` ${section.number}` : ""}`;

type LoadedSong = { title: string; key: string | null; tempoHint: { bpm: number; beatsPerBar: number } | null; sections: Section[] };

function idleReadoutFor(song: LoadedSong | null | undefined, fromSection: number): IdleReadout | null {
  if (!song) return null;
  const section = song.sections[fromSection];
  const bpm = section?.bpm ?? song.tempoHint?.bpm;
  const time = { beatsPerBar: section?.beatsPerBar ?? song.tempoHint?.beatsPerBar, beatUnit: section?.beatUnit };
  return bpm ? { value: String(Math.round(bpm)), unit: "BPM", ...time } : { value: "--", unit: "No Sections yet" };
}

function songFactsFor(song: LoadedSong | null | undefined, fromSection: number) {
  if (!song) return null;
  const section = song.sections[fromSection];
  const time = section ? timeSignatureOf(section) : song.tempoHint ? timeSignatureOf(song.tempoHint) : null;
  return [time, song.key ? `Key of ${song.key}` : null].filter(Boolean).join(" · ") || null;
}

const emptySong: Song = { countIn: false, sections: [] };

const MIX_TEXT_INSET = 38;

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

  const isAdmin = group.role === "admin";
  const startSongId = selectedSongId ?? playback?.songId ?? null;
  const startSong = selectedSongId ? selectedSong : playingSong;
  const shownSections = playing && playback ? playback.song.sections : (startSong?.sections ?? []);
  const [startPick, setStartPick] = useState<{ songId: Id<"songs">; index: number; bar: number } | null>(null);
  const pickedSection = startPick !== null && startPick.songId === startSongId && startPick.index < (startSong?.sections.length ?? 0) ? startPick.index : null;
  const startSection = pickedSection ?? 0;
  const startSectionBars = startSong?.sections[startSection]?.bars ?? 0;
  const pickedBar = pickedSection !== null && startPick !== null && startPick.bar > 1 && startPick.bar <= startSectionBars ? startPick.bar : null;
  const startBar = pickedBar ?? 1;
  const [stopPending, setStopPending] = useState(false);
  const currentSetlistId = useQuery(api.setlists.currentSetlistId, { groupId });
  const currentSetlist = useQuery(api.setlists.get, currentSetlistId ? { setlistId: currentSetlistId } : "skip");
  const library = useQuery(api.songs.list, { groupId });
  const setlistOrder = currentSetlist?.entries.map((entry) => entry.songId) ?? [];
  const [orderAt, setOrderAt] = useState<number | null>(null);
  const songOrder =
    setlistOrder.length > 0 && (startSongId === null || setlistOrder.includes(startSongId)) ? setlistOrder : (library ?? []).map((s) => s.songId);
  const startBlocker: "noSong" | "needsSections" | "loading" | null =
    startSongId === null ? "noSong" : startSong === undefined ? "loading" : startSong === null || startSong.sections.length === 0 ? "needsSections" : null;
  const start = useMutation(api.playback.start);
  const jump = useMutation(api.playback.jump);
  const stop = useMutation(api.playback.stop);
  const leave = useMutation(api.groups.leaveGroup);
  const recordings = useQuery(api.recordings.list, { groupId });
  const engine = useRef<CueAudioEngine | null>(null);
  const [soundOn, setSoundOn] = useState(false);
  const [soundBlocked, setSoundBlocked] = useState(false);
  const [soundProblem, setSoundProblem] = useState<string | null>(null);
  const [mix, setMix] = useState<CueMix>({ click: true, voiceCues: true, spokenCounts: true });
  const [clickVolume, setClickVolume, clickVolumeUnsaved] = useDeviceSetting("clickVolume", "0.8", isVolume);
  const [voiceVolume, setVoiceVolume, voiceVolumeUnsaved] = useDeviceSetting("voiceVolume", "0.9", isVolume);
  const [speaker, setSpeaker, speakerUnsaved] = useDeviceSetting<SpeakerId>("speaker", defaultSpeaker, isSpeakerId);
  const [latencyNudge] = useDeviceSetting("latencyNudgeMs", "0", isLatencySetting);
  const [jumpMode, setJumpMode] = useState<JumpMode>("endOfSection");
  const [beat, setBeat] = useState<Beat | null>(null);
  const [upcoming, setUpcoming] = useState<Beat["voiceCue"]>(null);
  const [nextIndex, setNextIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<GroupTab>("play");
  const scroller = useRef<ComponentRef<typeof ScrollView>>(null);
  const theme = useTheme();
  const dockInset = useDockInset(Spacing.one);
  const toast = useToast();
  const [askLeave, setAskLeave] = useState(false);
  const [leaving, setLeaving] = useState(false);
  usePreventRemove(playing && !leaving, () => setAskLeave(true));
  useEffect(() => {
    if (leaving) router.replace("/");
  }, [leaving]);
  useHeartbeat(groupId, tab === "play");
  const presence = usePresence(groupId, serverNow);
  const members = useQuery(api.groups.members, { groupId });
  const viewer = useQuery(api.users.viewer, {});
  const onPlayCount = countOnPlay(presence.rows, presence.nowMs);
  const stopping = playing && (stopPending || (playback?.stopsAt ?? null) !== null);

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

  useEffect(
    () => () => {
      engine.current?.dispose();
      engine.current = null;
      setSoundOn(false);
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;
    if (!engine.current) engine.current = new CueAudioEngine();
    engine.current
      .enable(serverNow, speaker)
      .then((running) => {
        if (cancelled) return;
        setSoundOn(running);
        setSoundBlocked(!running);
        setSoundProblem(running ? null : (engine.current?.failure ?? null));
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setSoundBlocked(true);
        setSoundProblem(describeAudioError(error));
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      const current = engine.current;
      if (state !== "active" || !current?.enabled) return;
      void current.resume().then((running) => {
        setSoundOn(running);
        setSoundBlocked(!running);
        setSoundProblem(running ? null : current.failure);
      });
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (soundOn) return;
    return onUserGesture(() => {
      const current = engine.current;
      if (!current) return;
      void current.wake().then((running) => {
        setSoundProblem(running ? null : current.failure);
        if (!running) return;
        setSoundOn(true);
        setSoundBlocked(false);
      });
    });
  }, [soundOn]);

  useEffect(() => {
    let handle = 0;
    const endsAt = playback && song.sections.length > 0 ? playbackEndsAt(song, playback) : -Infinity;
    const draw = () => {
      const now = serverNow();
      if (now !== null && playback && song.sections.length > 0) {
        const recent = beatsBetween(song, playback, now - 10_000, now + 1);
        const ahead = beatsBetween(song, playback, now, now + 60 * 60_000);
        const latest = recent.at(-1) ?? null;
        setBeat((previous) => (previous?.at === latest?.at ? previous : latest));
        const nextCue = upcomingVoiceCue(recent);
        setUpcoming((previous) => (sameVoiceCue(previous, nextCue) ? previous : nextCue));
        const following = nextSectionIndex(ahead);
        setNextIndex((previous) => (previous === following ? previous : following));
        setPlaying(now < endsAt);
      } else {
        setBeat(null);
        setUpcoming(null);
        setNextIndex(null);
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
      const current = engine.current;
      const running = await (current.enabled ? current.wake() : current.enable(serverNow, speaker)).catch((error: unknown) => {
        setSoundProblem(describeAudioError(error));
        throw error;
      });
      if (running) await current.setSpeaker(speaker);
      setSoundOn(running);
      setSoundProblem(running ? null : current.failure);
      if (!running) throw new Error("This device blocked sound. Check it is not on silent, then tap Enable again.");
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
  const idle = idleReadoutFor(startSong, startSection);
  const songFacts = songFactsFor(startSong, startSection);
  const followingSection = nextIndex === null ? undefined : song.sections[nextIndex];
  const nextLine = !playing ? null : upcoming ? titleOf(upcoming) : followingSection ? titleOf(followingSection) : "End of Song";
  const startHint =
    startBlocker === "noSong"
      ? "Pick a Song to start"
      : startBlocker === "needsSections"
        ? "Add Sections before this Song can start"
        : null;

  const startPlayback = () =>
    run(async () => {
      if (!startSongId) return;
      await start({ groupId, songId: startSongId, fromSection: pickedSection ?? undefined, fromBar: pickedBar ?? undefined });
      setStartPick(null);
    });

  const stopPlayback = () =>
    run(async () => {
      setStopPending(true);
      try {
        await stop({ groupId });
      } finally {
        setStopPending(false);
      }
    });

  const previousSong = neighbourSong(songOrder, startSongId, -1, orderAt);
  const nextSong = neighbourSong(songOrder, startSongId, 1, orderAt);
  const stepSong = (step: { item: Id<"songs">; at: number } | null) => {
    if (step === null) return;
    setSelectedSongId(step.item);
    setOrderAt(step.at);
  };

  const tapSection = (index: number) => {
    if (!isAdmin) return;
    if (playing) run(() => jump({ groupId, toSection: index, mode: jumpMode }));
    else if (startSongId) setStartPick({ songId: startSongId, index, bar: 1 });
  };

  const tapBar = (bar: number) => {
    if (isAdmin && startSongId) setStartPick({ songId: startSongId, index: startSection, bar });
  };

  const pickedTitle =
    pickedSection !== null && startSong ? `${titleOf(startSong.sections[pickedSection])}${pickedBar ? `, bar ${pickedBar}` : ""}` : null;

  const onlineMembers: StageMember[] = (members ?? [])
    .map((member, position) => ({
      userId: member.userId,
      name: member.displayName,
      position,
      pingMs: isAdmin ? otherMemberPing(presence.rows, member.userId, viewer?.id, presence.nowMs) : null,
    }))
    .filter((member) => memberPresence(presence.rows, member.userId, presence.nowMs, viewer?.id) !== "offline");
  const startLabel = startHint ?? "Start";

  const header = (
    <ScreenHeader
      title={group.name}
      subtitle={
        group.joinCode ? <JoinCodeActions code={group.joinCode} groupName={group.name} onDone={toast.show} /> : isAdmin ? "Admin" : "Member"
      }
      onBack={() => router.replace("/")}
      backLabel="Your Groups"
      backTestID="groups-back"
      right={
        <View style={styles.pill}>
          <SignalBars roundTripMs={estimate?.roundTripMs ?? null} />
          <ThemedText type="caption" themeColor="textSecondary" testID="clock-status" style={styles.pillText}>
            {estimate ? `${Math.round(estimate.roundTripMs)} ms${estimate.roundTripMs > WEAK_PING_MS ? " · weak" : ""}` : "Measuring…"}
          </ThemedText>
        </View>
      }
    />
  );

  const soundPromptFor = (testID: string) => (soundOn ? null : (
    <>
      <View style={[styles.soundPrompt, { backgroundColor: theme.accentTint }]}>
        <Icon name="sound" size={20} color="accent" />
        <ThemedText type="smallBold" style={styles.grow}>
          {soundBlocked && Platform.OS === "web" ? "Tap anywhere to turn on sound" : "Sound is off on this device"}
        </ThemedText>
        <ActionButton small accent label="Enable" testID={testID} onPress={enableSound} />
      </View>
      {soundProblem !== null && Platform.OS !== "web" ? (
        <ThemedText type="caption" themeColor="textSecondary" testID={`${testID}-problem`} selectable>
          {soundProblem}
        </ThemedText>
      ) : null}
    </>
  ));

  const playTab = (
    <View style={styles.playColumn}>
      <AudioDebug engine={engine} soundOn={soundOn} />
      {soundPromptFor("enable-sound")}
      {isAdmin ? (
        <View style={[styles.audience, { backgroundColor: theme.backgroundElement }]} testID="on-play-count">
          <Icon name="group" size={16} color="textSecondary" />
          <ThemedText type="caption" themeColor="textSecondary" style={styles.audienceText}>
            {onPlayCount === 1 ? "1 Member on Play" : `${onPlayCount} Members on Play`}
          </ThemedText>
        </View>
      ) : null}
      {playing ? (
        <View style={[styles.stageHead, styles.titleBlock]}>
          <ThemedText testID="song-title" themeColor="textSecondary" style={[styles.centered, styles.playingSong]} numberOfLines={1}>
            {shownTitle ?? " "}
          </ThemedText>
          <ThemedText
            type="title"
            testID="current-section"
            numberOfLines={1}
            style={[styles.centered, styles.sectionHeading, currentSection.length > 9 ? styles.sectionHeadingLong : null]}
          >
            {currentSection}
          </ThemedText>
          {beat ? <SectionProgress beat={beat} serverNow={serverNow} /> : null}
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
          {shownTitle && songFacts ? (
            <ThemedText type="small" themeColor="textSecondary" testID="song-facts" style={styles.centered}>
              {songFacts}
            </ThemedText>
          ) : null}
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
      <View style={styles.stageRow}>
        <BeatPulse beat={beat} playing={playing} idle={idle} />
        <StageMembers members={onlineMembers} beat={beat} playing={playing} />
      </View>
      {nextLine ? (
        <View style={styles.nextBlock}>
          <ThemedText themeColor="textSecondary" style={styles.nextLabel}>
            {upcoming ? "Next, in one bar" : "Next"}
          </ThemedText>
          <View style={styles.nextRow}>
            <Icon name="next" size={22} color="accent" />
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
                testID={`play-section-${index}`}
                selected={playing ? beat?.sectionIndex === index : isAdmin && startSection === index && startBlocker === null}
                onPress={() => tapSection(index)}
              />
            ))}
          </View>
          {isAdmin && !playing && startBlocker === null && startSectionBars > 1 ? (
            <View style={styles.barPicker}>
              <ThemedText type="caption" themeColor="textSecondary">
                Start at bar
              </ThemedText>
              <View style={styles.wrapTight} role="radiogroup" aria-label="Start at bar">
                {Array.from({ length: startSectionBars }, (_, offset) => offset + 1).map((bar) => (
                  <Chip key={bar} role="radio" label={String(bar)} testID={`play-bar-${bar}`} selected={startBar === bar} onPress={() => tapBar(bar)} />
                ))}
              </View>
            </View>
          ) : null}
          {isAdmin ? (
            <>
              {!playing ? (
                <ThemedText type="caption" themeColor="textSecondary" testID="start-from-hint">
                  Tap a Section and bar to start there with a one-bar Count-in.
                </ThemedText>
              ) : null}
              <View style={styles.jumpMode}>
                <ThemedText type="caption" themeColor="textSecondary" style={styles.jumpCaption}>
                  When I tap a Section, go
                </ThemedText>
                <View style={styles.jumpControl}>
                  <Segmented
                    compact
                    label="When I tap a Section, go"
                    value={jumpMode}
                    onChange={setJumpMode}
                    options={[
                      { value: "endOfSection", label: "After it" },
                      { value: "nextBar", label: "Next bar" },
                    ]}
                  />
                </View>
              </View>
            </>
          ) : null}
        </Card>
      ) : null}
    </View>
  );

  const setlistTab = (
    <SetlistCard
      groupId={groupId}
      isAdmin={isAdmin}
      selectedSongId={selectedSongId ?? playback?.songId ?? null}
      onSelect={setSelectedSongId}
      run={run}
    />
  );

  const songsTab = (
    <>
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
      {soundPromptFor("enable-sound-settings")}
      {soundOn ? (
        <Card title="Mix">
          <View style={styles.mixRow}>
            <View style={styles.mixHead}>
              <MetronomeIcon size={22} />
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
            <Icon name="numbered" size={22} color="textSecondary" />
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
            <ThemedText style={styles.rowTitle}>Latency nudge</ThemedText>
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
      <AccentPicker />
      {clickVolumeUnsaved || voiceVolumeUnsaved || speakerUnsaved ? (
        <ThemedText type="caption" themeColor="textSecondary" testID="setting-unsaved">
          This device could not save your choice, so it will reset when you reopen the app.
        </ThemedText>
      ) : null}
    </>
  );

  const groupTab = (
    <>
      <MembersCard groupId={groupId} groupName={group.name} isAdmin={isAdmin} presence={presence} />
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
        <ScrollView ref={scroller} contentContainerStyle={styles.content}>
          {header}
          {(
            [
              ["play", playTab],
              ["setlist", setlistTab],
              ["songs", songsTab],
              ["sound", soundTab],
              ["group", groupTab],
            ] as const
          ).map(([pane, content]) => (
            <View key={pane} role="tabpanel" id={panelId(pane)} aria-labelledby={tabId(pane)} style={tab === pane ? styles.tabPane : styles.hidden}>
              {content}
            </View>
          ))}
          {error ? (
            <ThemedText type="small" themeColor="danger" testID="error" style={styles.centered}>
              {error}
            </ThemedText>
          ) : null}
        </ScrollView>
        <View style={[styles.dock, { backgroundColor: theme.background, paddingBottom: dockInset }]}>
          {isAdmin && tab === "play" ? (
            <View style={styles.transport}>
              <IconButton
                icon="previousSong"
                label="Previous Song"
                testID="previous-song"
                size={ControlHeight.large}
                round
                filled
                disabled={playing || previousSong === null}
                onPress={() => stepSong(previousSong)}
              />
              {playing ? (
                <ActionButton
                  large
                  full
                  variant={stopping ? "secondary" : "stop"}
                  icon="stop"
                  label={stopping ? "Stopping…" : "Stop"}
                  accessibleName="Stop"
                  testID="stop"
                  pending={stopping}
                  onPress={stopPlayback}
                />
              ) : (
                <ActionButton
                  large
                  full
                  accent
                  icon="play"
                  label={startLabel}
                  accessibleName="Start"
                  testID="start"
                  disabled={startBlocker !== null}
                  onPress={startPlayback}
                />
              )}
              <IconButton
                icon="nextSong"
                label="Next Song"
                testID="next-song"
                size={ControlHeight.large}
                round
                filled
                disabled={playing || nextSong === null}
                onPress={() => stepSong(nextSong)}
              />
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
                  {stopping ? "Stopping…" : playing ? currentSection : (startHint ?? (pickedTitle ? `Ready to start from ${pickedTitle}` : "Ready to start"))}
                </ThemedText>
              </View>
              {playing ? (
                <ActionButton
                  medium
                  rounded
                  variant={stopping ? "secondary" : "stop"}
                  icon="stop"
                  label="Stop"
                  testID="stop"
                  pending={stopping}
                  onPress={stopPlayback}
                />
              ) : (
                <ActionButton medium rounded accent icon="play" label="Start" testID="start" disabled={startBlocker !== null} onPress={startPlayback} />
              )}
            </View>
          ) : null}
          <TabBar
            active={tab}
            onChange={(next) => {
              setTab(next);
              scroller.current?.scrollTo({ y: 0, animated: false });
            }}
          />
        </View>
      </SafeAreaView>
      <Toast message={toast.message} bottom={dockInset + ControlHeight.large * 2 + Spacing.four} />
      <ConfirmDialog
        visible={askLeave && !leaving}
        title="Leave Playback?"
        message={
          isAdmin
            ? "The Click and Voice cues stop on this device. Playback keeps going for everyone else until you come back and stop it."
            : "The Click and Voice cues stop on this device. Playback keeps going for everyone else."
        }
        confirmLabel="Leave"
        testID="leave-playback-dialog"
        onConfirm={() => setLeaving(true)}
        onCancel={() => setAskLeave(false)}
      />
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
  playColumn: { width: "100%", alignItems: "center", gap: Spacing.three },
  tabPane: { width: "100%", alignItems: "center", gap: Spacing.four },
  hidden: { display: "none" },
  sectionHeading: { fontSize: 56, lineHeight: 62 },
  sectionHeadingLong: { fontSize: 40, lineHeight: 50 },
  playingSong: { fontSize: 15, lineHeight: 20, fontWeight: 600 },
  idleTitle: { fontSize: 34, lineHeight: 40 },
  statusPill: { paddingHorizontal: 12, height: 28, borderRadius: Radius.pill, justifyContent: "center" },
  statusText: { fontSize: 13, lineHeight: 18, fontWeight: 600, letterSpacing: 0.8, textTransform: "uppercase" },
  titleBlock: { minHeight: 88, justifyContent: "center" },
  nextBlock: { alignItems: "center", gap: Spacing.one },
  nextLabel: { fontSize: 12, lineHeight: 16, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" },
  nextRow: { flexDirection: "row", alignItems: "center", gap: Spacing.one + 2, minHeight: 26 },
  nextText: { fontFamily: Fonts.display, fontSize: 24, lineHeight: 30, fontWeight: 700 },
  mixSlider: { paddingLeft: MIX_TEXT_INSET },
  mixRow: { gap: Spacing.one },
  mixHead: { flexDirection: "row", alignItems: "center", gap: Spacing.three },
  plainHint: { paddingHorizontal: Spacing.one },
  latencyValue: { fontSize: 17, fontWeight: 600, fontVariant: ["tabular-nums"], marginRight: Spacing.two },
  miniTitle: { fontSize: 15, lineHeight: 20, fontWeight: 600 },
  rowTitle: { fontSize: 17, lineHeight: 22, fontWeight: 600 },
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
  audience: { flexDirection: "row", alignItems: "center", gap: Spacing.one + 2, paddingHorizontal: 12, height: 28, borderRadius: Radius.pill },
  audienceText: { fontSize: 13, lineHeight: 18, fontWeight: 600, fontVariant: ["tabular-nums"] },
  leave: { width: "100%", paddingTop: Spacing.two, alignItems: "center" },
  switches: { gap: Spacing.three },
  miniBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.three,
    marginTop: Spacing.two,
    minHeight: 56,
    paddingVertical: Spacing.two,
    paddingHorizontal: 14,
    borderRadius: Radius.lg,
    maxWidth: MaxContentWidth,
    width: "100%",
    alignSelf: "center",
  },
  grow: { flex: 1, minWidth: 0 },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 12, alignItems: "center" },
  wrapTight: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.two, alignItems: "center" },
  barPicker: { gap: Spacing.two },
  stageRow: { alignItems: "center", width: "100%" },
  jumpMode: { flexDirection: "row", alignItems: "center", gap: 12 },
  jumpCaption: { flex: 1 },
  jumpControl: { width: 196 },
  linkRow: { flexDirection: "row", alignItems: "center", gap: Spacing.three, minHeight: 64, paddingVertical: Spacing.one },
  inlineLink: { flexDirection: "row", alignItems: "center", gap: Spacing.one, minHeight: 44 },
  tabular: { fontVariant: ["tabular-nums"] },
  centered: { textAlign: "center" },
  dock: { paddingHorizontal: Spacing.four },
  transport: { flexDirection: "row", alignItems: "center", gap: Spacing.two, paddingTop: 12, paddingBottom: Spacing.one, maxWidth: MaxContentWidth, width: "100%", alignSelf: "center" },
  backButton: { paddingHorizontal: Spacing.four, paddingVertical: Spacing.three, borderRadius: Radius.md },
});
