import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { router, useLocalSearchParams, usePreventRemove } from "expo-router";
import { useKeepAwake } from "expo-keep-awake";
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentRef } from "react";
import { AccessibilityInfo, AppState, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { describeAudioError } from "@/audio/audio-failure";
import type { SpeakerId } from "@/audio/builtin-voice-clips";
import { CueAudioEngine, type CueMix } from "@/audio/engine";
import { onUserGesture } from "@/audio/user-gesture";
import { ActionButton } from "@/components/action-button";
import { BeatPulse, type IdleReadout } from "@/components/playback/beat-pulse";
import { SectionProgress } from "@/components/playback/section-progress";
import { SongProgress } from "@/components/playback/song-progress";
import { StageMembers, type StageMember } from "@/components/playback/stage-members";
import { Card } from "@/components/group/card";
import { Chip } from "@/components/group/chip";
import { MembersCard } from "@/components/group/members-card";
import { SetlistCard } from "@/components/group/setlist-card";
import { SongsCard } from "@/components/group/songs-card";
import { groupTabs, panelId, TabBar, tabId, type GroupTab } from "@/components/group/tab-bar";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Icon } from "@/components/ui/icon";
import { IconButton } from "@/components/ui/icon-button";
import { ScreenHeader } from "@/components/ui/screen-header";
import { Segmented } from "@/components/ui/segmented";
import { SoundSettings } from "@/components/sound/sound-settings";
import { Connecting } from "@/components/ui/connecting";
import { SwipeTabs } from "@/components/ui/swipe-tabs";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Toast, useToast } from "@/components/ui/toast";
import { AudioDebug } from "@/components/audio-debug";
import { JoinCodeActions } from "@/components/group/join-code-actions";
import { SignalBars } from "@/components/ui/signal-bars";
import { useDockInset } from "@/components/ui/use-dock-inset";
import { ControlHeight, Fonts, MaxContentWidth, Radius, Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { errorText } from "@/lib/error-text";
import { useConnected } from "@/lib/use-connected";
import { neighbourSong } from "@/lib/song-order";
import { memberPresence, otherMemberPing } from "@/presence/online";
import { useHeartbeat, usePresence } from "@/presence/use-presence";
import { isLatencySetting } from "@/settings/latency";
import { useDeviceSetting } from "@/settings/use-device-setting";
import { useSoundSettings } from "@/settings/use-sound-settings";
import { beatsBetween, playbackEndsAt, timeSignatureOf, type Beat, type Playback, type Section, type Song } from "@/sync/timeline";
import { nextSectionIndex } from "@/sync/next-section";
import { shortTitleOf } from "@/sync/section-short";
import { playbackSpan, songLengthMs } from "@/sync/song-span";
import { WEAK_PING_MS } from "@/sync/ping-quality";
import { useServerClock } from "@/sync/use-server-clock";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";

type JumpMode = "endOfSection" | "nextBar";

const sameCue = (a: Beat["voiceCue"], b: Beat["voiceCue"]) =>
  a === b || (a !== null && b !== null && a.sectionType === b.sectionType && a.number === b.number);

const sameBeat = (a: Beat | null, b: Beat | null) =>
  a === b ||
  (a !== null &&
    b !== null &&
    a.at === b.at &&
    a.sectionIndex === b.sectionIndex &&
    a.lead?.barsLeft === b.lead?.barsLeft &&
    a.lead?.beats === b.lead?.beats &&
    sameCue(a.lead?.cue ?? null, b.lead?.cue ?? null));

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

type Tempo = { bpm: number; beatsPerBar: number; beatUnit?: number };

const tempoText = (tempo: Tempo | null | undefined) => (tempo ? `${timeSignatureOf(tempo)} · ${Math.round(tempo.bpm)} BPM` : null);

const emptySong: Song = { countIn: false, sections: [] };

const STAGE_HEAD_HEIGHT = 136;

const groupTabIds = groupTabs.map((item) => item.id);

type MyGroup = FunctionReturnType<typeof api.groups.myGroups>[number];

export default function GroupRoute() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const myGroups = useQuery(api.groups.myGroups, {});
  const theme = useTheme();
  if (myGroups === undefined) {
    return (
      <ThemedView style={[styles.container, styles.loading]}>
        <Connecting />
      </ThemedView>
    );
  }
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
          onPress={() => router.dismissTo("/")}
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
  const engine = useRef<CueAudioEngine | null>(null);
  const [soundOn, setSoundOn] = useState(false);
  const [soundBlocked, setSoundBlocked] = useState(false);
  const [soundProblem, setSoundProblem] = useState<string | null>(null);
  const { sound, update: updateSound, saveError: soundSaveError } = useSoundSettings();
  const { speaker, clickVolume, voiceVolume } = sound;
  const mix = useMemo<CueMix>(() => ({ click: sound.click, voiceCues: sound.voiceCues, spokenCounts: sound.spokenCounts }), [sound.click, sound.voiceCues, sound.spokenCounts]);
  const [latencyNudge] = useDeviceSetting("latencyNudgeMs", "0", isLatencySetting);
  const [jumpMode, setJumpMode] = useState<JumpMode>("endOfSection");
  const [beat, setBeat] = useState<Beat | null>(null);
  const [nextIndex, setNextIndex] = useState<number | null>(null);
  const [queuedKey, setQueuedKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<GroupTab>("play");
  const [dockHeight, setDockHeight] = useState(0);
  const [floatHeight, setFloatHeight] = useState(0);
  const scroller = useRef<ComponentRef<typeof ScrollView>>(null);
  const theme = useTheme();
  const dockInset = useDockInset(Spacing.one);
  const toast = useToast();
  const connected = useConnected();
  const [askLeave, setAskLeave] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [leavingGroup, setLeavingGroup] = useState(false);
  usePreventRemove(playing && !leaving && !leavingGroup, () => setAskLeave(true));
  useEffect(() => {
    if (leaving) router.dismissTo("/");
  }, [leaving]);
  useHeartbeat(groupId, tab === "play", playing);
  const presence = usePresence(groupId, serverNow);
  const members = useQuery(api.groups.members, { groupId });
  const viewer = useQuery(api.users.viewer, {});
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
    engine.current?.setVolumes({ click: clickVolume, voice: voiceVolume });
  }, [clickVolume, voiceVolume, soundOn]);

  useEffect(() => {
    if (engine.current) engine.current.latencyNudgeMs = Number(latencyNudge);
  }, [latencyNudge, soundOn]);

  useEffect(() => {
    if (!soundOn) return;
    engine.current?.setSpeaker(speaker).catch((e: unknown) => setError(errorText(e)));
  }, [speaker, soundOn]);


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
      current?.setHidden(state !== "active");
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
        setBeat((previous) => (sameBeat(previous, latest) ? previous : latest));
        const following = nextSectionIndex(ahead);
        setNextIndex((previous) => (previous === following ? previous : following));
        const queued = (playback.jumps ?? []).filter((j) => j.at > now).map((j) => j.toSection).join(",");
        setQueuedKey((previous) => (previous === queued ? previous : queued));
        setPlaying(now < endsAt);
      } else {
        setBeat(null);
        setNextIndex(null);
        setQueuedKey("");
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
      if (engine.current !== current) return;
      setSoundOn(running);
      setSoundProblem(running ? null : current.failure);
      if (running) await current.setSpeaker(speaker);
      if (!running) throw new Error("This device blocked sound. Check it is not on silent, then tap Enable again.");
    });

  const previewSpeaker = (next: SpeakerId) => {
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
  const queuedSections = queuedKey === "" ? [] : queuedKey.split(",").map(Number);
  const songFacts = startSong?.key ? `Key of ${startSong.key}` : null;
  const tempoSection = playing && playback ? song.sections[beat?.sectionIndex ?? playback.startSection] : startSong?.sections[startSection];
  const tempo = tempoText(tempoSection ?? (playing ? null : startSong?.tempoHint));
  const followingSection = nextIndex === null ? undefined : song.sections[nextIndex];
  const lead = playing ? (beat?.lead ?? null) : null;
  const upcoming = lead?.cue ?? null;
  const nextLabel = upcoming ? (lead?.barsLeft === 2 ? "Next, in two bars" : "Next, in one bar") : "Next";
  const nextLine = !playing ? null : upcoming ? titleOf(upcoming) : followingSection ? titleOf(followingSection) : "End of Song";
  const nextAnnouncement = nextLine ? `${nextLabel}: ${nextLine}` : null;
  useEffect(() => {
    if (Platform.OS === "ios" && nextAnnouncement) AccessibilityInfo.announceForAccessibilityWithOptions(nextAnnouncement, { queue: true });
  }, [nextAnnouncement]);

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
      pingMs:
        member.userId === viewer?.id
          ? (estimate?.roundTripMs ?? null)
          : isAdmin
            ? otherMemberPing(presence.rows, member.userId, viewer?.id, presence.nowMs)
            : null,
      isYou: member.userId === viewer?.id,
    }))
    .filter((member) => memberPresence(presence.rows, member.userId, presence.nowMs, viewer?.id) !== "offline");
  const startLabel = startHint ?? "Start";
  const songSpan = useMemo(() => (playing && playback && song.sections.length > 0 ? playbackSpan(song, playback) : null), [playing, playback, song]);
  const startLength = startSong ? songLengthMs({ countIn: pickedSection !== null || startSong.countIn, sections: startSong.sections }, startSection, startBar) : 0;

  const header = (
    <ScreenHeader
      title={group.name}
      subtitle={
        group.joinCode ? <JoinCodeActions code={group.joinCode} groupName={group.name} onDone={toast.show} /> : isAdmin ? "Admin" : "Member"
      }
      onBack={() => (playing && !leaving ? setAskLeave(true) : router.dismissTo("/"))}
      backLabel="Your Groups"
      backTestID="groups-back"
      right={
        <View style={styles.headerRight}>
          {tab === "play" && tempo ? (
            <ThemedText testID="tempo" numberOfLines={1} style={styles.tempo}>
              {tempo}
            </ThemedText>
          ) : null}
          <View style={styles.pill}>
            <SignalBars roundTripMs={connected ? (estimate?.roundTripMs ?? null) : null} />
            <ThemedText type="caption" themeColor="textSecondary" testID="clock-status" numberOfLines={1} style={styles.pillText}>
              {!connected ? "Connecting…" : estimate ? `${Math.round(estimate.roundTripMs)} ms${estimate.roundTripMs > WEAK_PING_MS ? " weak" : ""}` : "Measuring…"}
            </ThemedText>
            <ThemedText type="caption" themeColor="textSecondary" testID="online-count" numberOfLines={1} style={styles.pillText}>
              · {onlineMembers.length} online
            </ThemedText>
          </View>
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
          <ThemedText type="title" testID="song-title" style={[styles.centered, styles.idleTitle]} numberOfLines={2}>
            {shownTitle ?? (isAdmin ? "Pick a Song" : "Waiting for an Admin")}
          </ThemedText>
          {shownTitle && songFacts ? (
            <ThemedText type="small" themeColor="textSecondary" testID="song-facts" style={styles.centered}>
              {songFacts}
            </ThemedText>
          ) : null}
        </View>
      )}
      <View style={styles.stageRow}>
        <BeatPulse beat={beat} playing={playing} idle={idle} />
        <StageMembers members={onlineMembers} beat={beat} playing={playing} />
      </View>
      {playing ? null : (
        <View style={styles.nextBlock}>
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
      {nextLine ? (
        <View style={styles.nextBlock} aria-live="polite" testID="playback-next-block">
          <ThemedText themeColor="textSecondary" style={styles.nextLabel}>
            {nextLabel}
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
                compact
                label={shortTitleOf(section)}
                accessibleName={titleOf(section)}
                queued={playing && queuedSections.includes(index)}
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
                  Tap a Section and bar to start there with a two-bar Count-in.
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

  const showTab = (next: GroupTab) => {
    setTab(next);
    scroller.current?.scrollTo({ y: 0, animated: false });
  };

  const playSong = (songId: Id<"songs">) => {
    setSelectedSongId(songId);
    showTab("play");
  };

  const setlistTab = (
    <SetlistCard
      groupId={groupId}
      isAdmin={isAdmin}
      selectedSongId={selectedSongId ?? playback?.songId ?? null}
      onSelect={playSong}
      run={run}
    />
  );

  const songsTab = (
    <>
      <SongsCard
        groupId={groupId}
        isAdmin={isAdmin}
        selectedSongId={selectedSongId ?? playback?.songId ?? null}
        onPlay={playSong}
        run={run}
      />
    </>
  );

  const soundTab = (
    <SoundSettings
      sound={sound}
      update={updateSound}
      saveError={soundSaveError}
      prompt={soundPromptFor("enable-sound-settings")}
      speakerHint={soundOn ? null : "Enable sound to hear each Speaker as you choose."}
      onSpeaker={previewSpeaker}
    />
  );

  const groupTab = (
    <>
      <MembersCard groupId={groupId} groupName={group.name} isAdmin={isAdmin} presence={presence} />
      <View style={styles.leave}>
        <ActionButton
          variant="danger"
          icon="logout"
          label="Leave Group"
          testID="leave-group"
          onPress={() =>
            run(async () => {
              setLeavingGroup(true);
              try {
                await leave({ groupId });
              } catch (error) {
                setLeavingGroup(false);
                throw error;
              }
              router.dismissTo("/");
            })
          }
        />
      </View>
    </>
  );

  const playCard =
    tab === "play" && (isAdmin || songSpan !== null || startLength > 0) ? (
      <View style={[styles.floatCard, { backgroundColor: theme.background, borderColor: theme.border, shadowColor: theme.text }]} testID="play-controls">
        {isAdmin ? (
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
        <SongProgress span={songSpan} lengthMs={startLength} serverNow={serverNow} />
      </View>
    ) : null;

  const miniCard =
    isAdmin && tab !== "play" ? (
      <View style={[styles.floatCard, styles.miniBar, { backgroundColor: theme.background, borderColor: theme.border, shadowColor: theme.text }]} testID="mini-bar">
        <Pressable
          role="button"
          aria-label={`Open Play, ${shownTitle ?? "No Song picked"}`}
          testID="mini-bar-open-play"
          onPress={() => showTab("play")}
          style={({ pressed }) => [styles.miniOpen, pressed ? styles.pressed : null]}
        >
          <Icon name={playing ? "pulse" : "songs"} size={20} color={playing ? "accent" : "textSecondary"} />
          <View style={styles.grow}>
            <ThemedText numberOfLines={1} style={styles.miniTitle}>
              {shownTitle ?? "No Song picked"}
            </ThemedText>
            <ThemedText type="caption" themeColor="textSecondary" numberOfLines={1}>
              {stopping ? "Stopping…" : playing ? currentSection : (startHint ?? (pickedTitle ? `Ready to start from ${pickedTitle}` : "Ready to start"))}
            </ThemedText>
          </View>
        </Pressable>
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
    ) : null;

  const floating = playCard ?? miniCard;

  return (
    <ThemedView style={styles.container}>
      {playing ? <KeepAwake /> : null}
      <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
        <SwipeTabs tabs={groupTabIds} active={tab} onChange={showTab}>
        <ScrollView ref={scroller} contentContainerStyle={[styles.content, { paddingBottom: Spacing.five + (floating ? floatHeight : 0) }]}>
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
        </SwipeTabs>
        {floating ? (
          <View pointerEvents="box-none" style={[styles.floatLayer, { bottom: dockHeight }]} onLayout={(event) => setFloatHeight(event.nativeEvent.layout.height)}>
            {floating}
          </View>
        ) : null}
        <View style={[styles.dock, { backgroundColor: theme.background, borderTopColor: theme.border, paddingBottom: dockInset }]} onLayout={(event) => setDockHeight(event.nativeEvent.layout.height)}>
          <TabBar tabs={groupTabs} active={tab} onChange={showTab} />
        </View>
      </SafeAreaView>
      <Toast message={toast.message} bottom={dockHeight + (floating ? floatHeight : 0) + Spacing.two} />
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
  loading: { justifyContent: "center", alignItems: "center" },
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
  headerRight: { alignItems: "flex-end", flexShrink: 0 },
  tempo: { fontSize: 15, lineHeight: 20, fontWeight: 700, fontVariant: ["tabular-nums"] },
  pill: { flexDirection: "row", alignItems: "center", gap: Spacing.one, height: 24 },
  pillText: { fontSize: 13, fontWeight: 500, fontVariant: ["tabular-nums"] },
  stageHead: { alignItems: "center", gap: Spacing.one, width: "100%" },
  playColumn: { width: "100%", alignItems: "center", gap: Spacing.three },
  tabPane: { width: "100%", alignItems: "center", gap: Spacing.four },
  hidden: { display: "none" },
  sectionHeading: { fontSize: 56, lineHeight: 62 },
  sectionHeadingLong: { fontSize: 40, lineHeight: 50 },
  playingSong: { fontSize: 15, lineHeight: 20, fontWeight: 600 },
  idleTitle: { fontSize: 34, lineHeight: 40 },
  titleBlock: { height: STAGE_HEAD_HEIGHT, justifyContent: "center" },
  nextBlock: { alignItems: "center", gap: Spacing.one },
  nextLabel: { fontSize: 12, lineHeight: 16, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" },
  nextRow: { flexDirection: "row", alignItems: "center", gap: Spacing.one + 2, minHeight: 26 },
  nextText: { fontFamily: Fonts.display, fontSize: 24, lineHeight: 30, fontWeight: 700 },
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
  miniOpen: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: Spacing.three, minHeight: 44 },
  pressed: { opacity: 0.6 },
  miniBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.three,
    minHeight: 56,
    paddingVertical: Spacing.two,
    paddingHorizontal: 14,
    borderRadius: Radius.lg,
    maxWidth: MaxContentWidth,
    width: "100%",
    alignSelf: "center",
  },
  grow: { flex: 1, minWidth: 0 },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.two, alignItems: "center" },
  wrapTight: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.two, alignItems: "center" },
  barPicker: { gap: Spacing.two },
  stageRow: { alignItems: "center", width: "100%" },
  jumpMode: { flexDirection: "row", alignItems: "center", gap: 12 },
  jumpCaption: { flex: 1 },
  jumpControl: { width: 196 },
  inlineLink: { flexDirection: "row", alignItems: "center", gap: Spacing.one, minHeight: 44 },
  centered: { textAlign: "center" },
  dock: { paddingHorizontal: Spacing.four, borderTopWidth: StyleSheet.hairlineWidth },
  floatLayer: { position: "absolute", left: 0, right: 0, paddingHorizontal: Spacing.three, paddingBottom: Spacing.two, alignItems: "center" },
  floatCard: {
    width: "100%",
    maxWidth: MaxContentWidth,
    gap: Spacing.two,
    padding: Spacing.two,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    shadowOpacity: 0.16,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  transport: { flexDirection: "row", alignItems: "center", gap: Spacing.two, width: "100%" },
  backButton: { paddingHorizontal: Spacing.four, paddingVertical: Spacing.three, borderRadius: Radius.md },
});
