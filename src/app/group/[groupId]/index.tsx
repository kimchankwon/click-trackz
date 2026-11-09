import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { router, useLocalSearchParams, usePreventRemove } from "expo-router";
import { useKeepAwake } from "expo-keep-awake";
import { useCallback, useEffect, useEffectEvent, useMemo, useRef, useState, type ComponentRef } from "react";
import { AccessibilityInfo, AppState, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { describeAudioError } from "@/audio/audio-failure";
import type { SpeakerId } from "@/audio/builtin-voice-clips";
import { CueAudioEngine, type CueMix } from "@/audio/engine";
import { onUserGesture } from "@/audio/user-gesture";
import { ActionButton } from "@/components/action-button";
import { BeatPulse, type IdleReadout } from "@/components/playback/beat-pulse";
import { SectionChip } from "@/components/playback/section-chip";
import { SectionProgress } from "@/components/playback/section-progress";
import { SongProgress } from "@/components/playback/song-progress";
import { StageMembers, type StageMember } from "@/components/playback/stage-members";
import { TempoPanel } from "@/components/playback/tempo-panel";
import { Card } from "@/components/group/card";
import { Chip } from "@/components/group/chip";
import { MembersCard } from "@/components/group/members-card";
import { RenameGroup } from "@/components/group/rename-group";
import { SetlistCard } from "@/components/group/setlist-card";
import { SongsCard } from "@/components/group/songs-card";
import { groupTabs, panelId, TabBar, tabId, type GroupTab } from "@/components/group/tab-bar";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Icon } from "@/components/ui/icon";
import { IconButton } from "@/components/ui/icon-button";
import { ScreenHeader } from "@/components/ui/screen-header";
import { PinnedHeader, PINNED_CONTENT_TOP, usePinnedHeader } from "@/components/ui/pinned-header";
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
import { copyBaseOf, copyTitle, MAX_GROUP_NAME } from "@/lib/copy-title";
import { errorText } from "@/lib/error-text";
import { setPlayingHere } from "@/lib/playing-here";
import { useConnected } from "@/lib/use-connected";
import { neighbourSong } from "@/lib/song-order";
import { nextInSetlist, setlistPosition } from "@/lib/setlist-next";
import { hapticsAvailable, tapHaptic } from "@/audio/haptics";
import { hapticFor, isHapticBeat, isSide, type HapticBeat, type Side } from "@/settings/output";
import { memberPresence, otherMemberPing } from "@/presence/online";
import { useHeartbeat, usePresence } from "@/presence/use-presence";
import { isLatencySetting } from "@/settings/latency";
import { isVoiceOffsetSetting } from "@/settings/voice-offset";
import { useDeviceSetting } from "@/settings/use-device-setting";
import { useSoundSettings } from "@/settings/use-sound-settings";
import {
  endVampJumps,
  jumpProblem,
  jumpsAfter,
  repeatJumps,
  startedPlayback,
  startProblem,
  stopTime,
  type CommandResult,
  type StartedPlayback,
} from "@/sync/commands";
import { aheadWindowMs, beatsBetween, longestBeatMs, playbackEndsAt, playsOf, timeSignatureOf, vampingSection, type Beat, type Playback, type Section, type Song } from "@/sync/timeline";
import { nextSectionStart, type SectionStart } from "@/sync/next-section";
import { shortTitleOf } from "@/sync/section-short";
import { commonBpm } from "@/sync/song-tempo";
import { playbackSpan, songLengthMs } from "@/sync/song-span";
import { WEAK_PING_MS } from "@/sync/ping-quality";
import { deviceNow, useServerClock } from "@/sync/use-server-clock";
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
    a.lead?.pass === b.lead?.pass &&
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

const passText = (start: Pick<SectionStart, "pass" | "passes"> | null | undefined) => (start && start.passes > 1 ? ` (${start.pass} of ${start.passes})` : "");

const sameStart = (a: SectionStart | null, b: SectionStart | null) =>
  a === b || (a !== null && b !== null && a.sectionIndex === b.sectionIndex && a.pass === b.pass && a.passes === b.passes);

type LoadedSong = { title: string; key: string | null; tempoHint: { bpm: number; beatsPerBar: number } | null; sections: Section[] };

function idleReadoutFor(song: LoadedSong | null | undefined, fromSection: number): IdleReadout | null {
  if (!song) return null;
  const section = song.sections[fromSection];
  const bpm = section?.bpm ?? song.tempoHint?.bpm;
  const time = { beatsPerBar: section?.beatsPerBar ?? song.tempoHint?.beatsPerBar, beatUnit: section?.beatUnit };
  return bpm ? { value: String(Math.round(bpm)), unit: "BPM", ...time } : { value: "--", unit: "No Sections yet" };
}

type Tempo = { bpm: number; beatsPerBar: number; beatUnit?: number };

const tempoText = (tempo: Tempo | null | undefined) => (tempo ? { time: timeSignatureOf(tempo), bpm: `${Math.round(tempo.bpm)} BPM` } : null);

const emptySong: Song = { countIn: false, sections: [] };

const STAGE_HEAD_HEIGHT = 164;

const RECENT_BEATS_MS = 10_000;

type MyGroup = FunctionReturnType<typeof api.groups.myGroups>[number];

type ShownPlayback = Playback & {
  songId: Id<"songs">;
  song: Song;
  startedBy: Id<"users"> | null;
  startedByName: string | null;
  stoppedBy: Id<"users"> | null;
  stoppedByName: string | null;
  advance?: boolean;
  setlistIndex?: number | null;
};

type DevicePlayback = StartedPlayback & {
  songId: Id<"songs">;
  startedBy: null;
  startedByName: null;
  stoppedBy: null;
  stoppedByName: null;
  setlistIndex?: number;
};

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
  if (group) return <GroupScreen group={group} groupNames={myGroups.map((mine) => mine.name)} />;
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

const startedFromSetlist = (playback: { setlistIndex?: number | null }) => playback.setlistIndex !== null && playback.setlistIndex !== undefined;

const countOf = (count: number, noun: string) => `${count} ${noun}${count === 1 ? "" : "s"}`;

function GroupScreen({ group, groupNames }: { group: MyGroup; groupNames: readonly string[] }) {
  const groupId = group.groupId;
  const offline = group.offline;
  const isAdmin = group.role === "admin";
  const [offlinePlay, setOfflinePlay] = useState(false);
  const onDevice = offline || offlinePlay;
  const steers = isAdmin || onDevice;
  const [playing, setPlaying] = useState(false);
  const { estimate, serverNow } = useServerClock({ playing, onDevice: offline });
  const playNow = onDevice ? deviceNow : serverNow;
  const playbackDoc = useQuery(api.playback.current, offline ? "skip" : { groupId });
  const groupPlayback = (playbackDoc ?? null) as ShownPlayback | null;
  const [devicePlayback, setDevicePlayback] = useState<DevicePlayback | null>(null);
  const playback: ShownPlayback | null = onDevice ? devicePlayback : groupPlayback;
  const [selectedSongId, setSelectedSongId] = useState<Id<"songs"> | null>(null);
  const [pickedFromSetlist, setPickedFromSetlist] = useState(false);
  const playingSong = useQuery(api.songs.get, playback ? { songId: playback.songId } : "skip");
  const selectedSong = useQuery(api.songs.get, selectedSongId ? { songId: selectedSongId } : "skip");
  const song: Song = playback?.song ?? emptySong;
  const showPlayback = playback !== null && (playing || selectedSongId === null);
  const shownTitle = showPlayback ? playingSong?.title : selectedSong?.title;

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
  const [mutedStart, setMutedStart] = useState<number | null>(null);
  const muted = playing && playback !== null && mutedStart === playback.startsAt;
  const currentSetlistId = useQuery(api.setlists.currentSetlistId, { groupId });
  const currentSetlist = useQuery(api.setlists.get, currentSetlistId ? { setlistId: currentSetlistId } : "skip");
  const library = useQuery(api.songs.list, { groupId });
  const setlistOrder = currentSetlist?.entries.map((entry) => entry.songId) ?? [];
  const playableInSetlist = new Set(currentSetlist?.entries.filter((entry) => !entry.needsStructure).map((entry) => entry.songId) ?? []);
  const playingPosition = playback ? setlistPosition(setlistOrder, playback.songId, playback.setlistIndex) : null;
  const nextUp = playingPosition === null ? null : nextInSetlist(setlistOrder, playingPosition, (id) => playableInSetlist.has(id));
  const nextUpId = nextUp?.item ?? null;
  const nextUpTitle = nextUpId === null ? null : (currentSetlist?.entries.find((entry) => entry.songId === nextUpId)?.title ?? null);
  const [orderAt, setOrderAt] = useState<number | null>(null);
  const songOrder =
    setlistOrder.length > 0 && (startSongId === null || setlistOrder.includes(startSongId)) ? setlistOrder : (library ?? []).map((s) => s.songId);
  const startBlocker: "noSong" | "needsSections" | "loading" | null =
    startSongId === null ? "noSong" : startSong === undefined ? "loading" : startSong === null || startSong.sections.length === 0 ? "needsSections" : null;
  const start = useMutation(api.playback.start);
  const jump = useMutation(api.playback.jump);
  const stop = useMutation(api.playback.stop);
  const repeatSection = useMutation(api.playback.repeatSection);
  const endVamp = useMutation(api.playback.endVamp);
  const [clickSide] = useDeviceSetting<Side>("clickSide", "both", isSide);
  const [voiceSide] = useDeviceSetting<Side>("voiceSide", "both", isSide);
  const [hapticBeat] = useDeviceSetting<HapticBeat>("hapticBeat", "off", isHapticBeat);
  const leave = useMutation(api.groups.leaveGroup);
  const duplicateGroup = useMutation(api.groups.duplicateGroup);
  const setlists = useQuery(api.setlists.list, offline ? "skip" : { groupId });
  const [confirmingDuplicate, setConfirmingDuplicate] = useState(false);
  const [duplicatePending, setDuplicatePending] = useState(false);
  const [duplicateError, setDuplicateError] = useState<string | null>(null);
  const [confirmingLeave, setConfirmingLeave] = useState(false);
  const [leaveError, setLeaveError] = useState<string | null>(null);
  const attempt = useRef(0);
  const deleteGroup = useMutation(api.groups.deleteGroup);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deletePending, setDeletePending] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [startPending, setStartPending] = useState(false);
  const updateSong = useMutation(api.songs.updateSong);
  const [editingTempo, setEditingTempo] = useState<Id<"songs"> | null>(null);
  const [unclocked, setUnclocked] = useState(false);
  const engine = useRef<CueAudioEngine | null>(null);
  const [soundOn, setSoundOn] = useState(false);
  const [soundBlocked, setSoundBlocked] = useState(false);
  const [soundProblem, setSoundProblem] = useState<string | null>(null);
  const { sound, update: updateSound, saveError: soundSaveError } = useSoundSettings();
  const { speaker, clickVolume, voiceVolume } = sound;
  const mix = useMemo<CueMix>(() => ({ click: sound.click, voiceCues: sound.voiceCues, spokenCounts: sound.spokenCounts }), [sound.click, sound.voiceCues, sound.spokenCounts]);
  const [latencyNudge] = useDeviceSetting("latencyNudgeMs", "0", isLatencySetting);
  const [voiceOffset] = useDeviceSetting("voiceOffsetMs", "0", isVoiceOffsetSetting);
  const [jumpMode, setJumpMode] = useState<JumpMode>("endOfSection");
  const [beat, setBeat] = useState<Beat | null>(null);
  const [nextStart, setNextStart] = useState<SectionStart | null>(null);
  const [queuedKey, setQueuedKey] = useState("");
  const [tab, setTab] = useState<GroupTab>("play");
  const [dockHeight, setDockHeight] = useState(0);
  const [floatHeight, setFloatHeight] = useState(0);
  const scroller = useRef<ComponentRef<typeof ScrollView>>(null);
  const pinned = usePinnedHeader();
  const theme = useTheme();
  const dockInset = useDockInset(Spacing.one);
  const toast = useToast();
  const showToast = toast.show;
  const connected = useConnected();
  const [askLeave, setAskLeave] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [leavingGroup, setLeavingGroup] = useState(false);
  usePreventRemove(playing && !leaving && !leavingGroup, () => setAskLeave(true));
  const tabs = useMemo(() => (offline ? groupTabs.filter((item) => item.id !== "group") : groupTabs), [offline]);
  const tabIds = useMemo(() => tabs.map((item) => item.id), [tabs]);
  useEffect(() => {
    if (leaving) router.dismissTo("/");
  }, [leaving]);
  useHeartbeat(groupId, tab === "play", playing, !offline);
  const presence = usePresence(groupId, serverNow, !offline);
  const members = useQuery(api.groups.members, offline ? "skip" : { groupId });
  const viewer = useQuery(api.users.viewer, {});
  const stopping = playing && (stopPending || (playback?.stopsAt ?? null) !== null);

  useEffect(() => {
    engine.current?.setServerClock(playNow);
  }, [playNow]);

  const groupEndsAt = useMemo(
    () => (offlinePlay && groupPlayback && groupPlayback.song.sections.length > 0 ? playbackEndsAt(groupPlayback.song, groupPlayback) : null),
    [offlinePlay, groupPlayback],
  );
  const [groupPlaying, setGroupPlaying] = useState(false);
  useEffect(() => {
    const check = () => {
      const now = serverNow();
      setGroupPlaying(groupEndsAt !== null && now !== null && now < groupEndsAt);
      return groupEndsAt === null || (now !== null && now >= groupEndsAt);
    };
    if (check()) return;
    const timer = setInterval(() => {
      if (check()) clearInterval(timer);
    }, 1_000);
    return () => clearInterval(timer);
  }, [groupEndsAt, serverNow]);

  useEffect(() => {
    engine.current?.setPlan(song, song.sections.length > 0 && !muted ? playback : null);
  }, [song, playback, soundOn, muted]);

  useEffect(() => {
    if (engine.current) engine.current.mix = mix;
  }, [mix, soundOn]);

  useEffect(() => {
    engine.current?.setVolumes({ click: clickVolume, voice: voiceVolume });
  }, [clickVolume, voiceVolume, soundOn]);

  useEffect(() => {
    engine.current?.setSides({ click: clickSide, voice: voiceSide });
  }, [clickSide, voiceSide, soundOn]);

  useEffect(() => {
    if (engine.current) engine.current.latencyNudgeMs = Number(latencyNudge);
  }, [latencyNudge, soundOn]);

  useEffect(() => {
    if (engine.current) engine.current.voiceOffsetMs = Number(voiceOffset);
  }, [voiceOffset, soundOn]);

  useEffect(() => {
    if (!soundOn) return;
    engine.current?.setSpeaker(speaker).catch((e: unknown) => showToast(errorText(e), "error"));
  }, [speaker, soundOn, showToast]);


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
      .enable(playNow, speaker)
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
      const now = playNow();
      if (now !== null && playback && song.sections.length > 0) {
        const recent = beatsBetween(song, playback, now - Math.max(RECENT_BEATS_MS, longestBeatMs(song)), now + 1);
        const ahead = beatsBetween(song, playback, now, now + aheadWindowMs(song));
        const latest = recent.at(-1) ?? null;
        setBeat((previous) => (sameBeat(previous, latest) ? previous : latest));
        const following = nextSectionStart(ahead);
        setNextStart((previous) => (sameStart(previous, following) ? previous : following));
        const queued = (playback.jumps ?? []).filter((j) => j.at > now).map((j) => j.toSection).join(",");
        setQueuedKey((previous) => (previous === queued ? previous : queued));
        setPlaying(now < endsAt);
        setUnclocked(false);
      } else {
        setUnclocked(now === null && playback !== null);
        setBeat(null);
        setNextStart(null);
        setQueuedKey("");
        setPlaying(false);
      }
      handle = requestAnimationFrame(draw);
    };
    handle = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(handle);
  }, [playNow, playback, song]);

  useEffect(() => {
    setPlayingHere(playing);
  }, [playing]);

  const tapBeat = useEffectEvent((latest: Beat) => {
    if (!playing || !hapticsAvailable) return;
    const strength = hapticFor(hapticBeat, latest);
    if (strength !== null) tapHaptic(strength);
  });
  useEffect(() => {
    if (beat) tapBeat(beat);
  }, [beat]);

  const lineUpNext = useEffectEvent(() => {
    if (!steers || playback === null || !startedFromSetlist(playback) || playback.stopsAt !== null || nextUp === null) return;
    setSelectedSongId(nextUp.item);
    setPickedFromSetlist(true);
    setOrderAt(nextUp.index);
    setStartPick(null);
  });
  const [followedStart, setFollowedStart] = useState<number | null>(null);
  if (playback !== null && playback.startsAt !== followedStart) {
    setFollowedStart(playback.startsAt);
    if (steers && startedFromSetlist(playback)) {
      setPickedFromSetlist(true);
      if (playback.songId !== selectedSongId) {
        setSelectedSongId(playback.songId);
        setOrderAt(playingPosition);
        setStartPick(null);
      }
    }
  }
  const wasPlaying = useRef(false);
  useEffect(() => {
    const ended = wasPlaying.current && !playing;
    wasPlaying.current = playing;
    if (ended) lineUpNext();
  }, [playing]);

  useEffect(() => () => setPlayingHere(false), []);

  const run = useCallback(
    (action: () => Promise<unknown>) => {
      action().catch((e: unknown) => showToast(errorText(e), "error"));
    },
    [showToast],
  );

  const enableSound = () =>
    run(async () => {
      if (!engine.current) engine.current = new CueAudioEngine();
      const current = engine.current;
      const running = await (current.enabled ? current.wake() : current.enable(playNow, speaker)).catch((error: unknown) => {
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
  const barTempo = playing && beat !== null && beat.sectionIndex !== null && tempoSection ? { bpm: tempoSection.bpm, beatsPerBar: beat.beatsPerBar, beatUnit: beat.beatUnit } : tempoSection;
  const tempo = tempoText(barTempo ?? (playing ? null : startSong?.tempoHint));
  const followingSection = nextStart === null ? undefined : song.sections[nextStart.sectionIndex];
  const lead = playing ? (beat?.lead ?? null) : null;
  const upcoming = lead?.cue ?? null;
  const nextLabel = upcoming ? (lead?.barsLeft === 2 ? "Next, in two bars" : "Next, in one bar") : "Next";
  const endLine = playback?.advance && nextUpTitle ? `Next Song: ${nextUpTitle}` : "End of Song";
  const nextLine = !playing
    ? null
    : upcoming
      ? `${titleOf(upcoming)}${passText(lead)}`
      : followingSection
        ? `${titleOf(followingSection)}${passText(nextStart)}`
        : endLine;
  const vampSection = playing && playback !== null && song.sections.length > 0 ? vampingSection(song, playback) : null;
  const vampTitle = vampSection === null ? null : titleOf(song.sections[vampSection]);
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
      const from = { fromSection: pickedSection ?? undefined, fromBar: pickedBar ?? undefined };
      const startPosition = pickedFromSetlist && setlistOrder.includes(startSongId) ? setlistPosition(setlistOrder, startSongId, orderAt) : null;
      const position = startPosition === null ? {} : { setlistIndex: startPosition };
      if (onDevice) {
        if (!startSong) return;
        const problem = startProblem(startSong, from);
        if (problem !== null) throw new Error(problem);
        setDevicePlayback({
          songId: startSongId,
          startedBy: null,
          startedByName: null,
          stoppedBy: null,
          stoppedByName: null,
          ...position,
          ...startedPlayback(startSong, from, deviceNow()),
        });
      } else {
        if (startPending) return;
        setStartPending(true);
        try {
          await start({ groupId, songId: startSongId, ...from, ...position });
        } finally {
          setStartPending(false);
        }
      }
      setStartPick(null);
    });

  const jumpOnDevice = (toSection: number) => {
    if (devicePlayback === null) return;
    const problem = jumpProblem(devicePlayback.song, toSection);
    if (problem !== null) throw new Error(problem);
    const jumps = jumpsAfter(devicePlayback.song, devicePlayback, toSection, jumpMode, deviceNow());
    if (jumps === null) throw new Error("Playback has already ended");
    setDevicePlayback({ ...devicePlayback, jumps });
  };

  const commandOnDevice = (command: (current: DevicePlayback) => CommandResult) => {
    if (devicePlayback === null) return;
    const result = command(devicePlayback);
    if ("problem" in result) throw new Error(result.problem);
    setDevicePlayback({ ...devicePlayback, jumps: result.jumps });
  };

  const repeatNow = (vamp: boolean) =>
    run(async () => {
      if (onDevice) commandOnDevice((current) => repeatJumps(current.song, current, deviceNow(), vamp));
      else await repeatSection({ groupId, startsAt: playback?.startsAt, ...(vamp ? { vamp } : {}) });
      showToast(vamp ? "Vamps from the end of this pass until you end it" : "Plays once more after this pass");
    });

  const endVampNow = () =>
    run(async () => {
      if (onDevice) commandOnDevice((current) => endVampJumps(current.song, current, deviceNow()));
      else await endVamp({ groupId, startsAt: playback?.startsAt });
      showToast("Moves on at the end of this pass");
    });

  const runCarriesOn = playing || nextUp !== null;
  const onSetlistRun = showPlayback
    ? startedFromSetlist(playback) && playback.stopsAt === null && runCarriesOn
    : pickedFromSetlist && startSongId !== null && setlistOrder.includes(startSongId);
  const screenTitle = onSetlistRun && currentSetlist ? currentSetlist.name : group.name;

  const stopOnDevice = () => {
    if (devicePlayback === null) return;
    const stopsAt = stopTime(devicePlayback.song, devicePlayback, deviceNow(), 0);
    if (stopsAt === null) throw new Error("Playback has already ended");
    setDevicePlayback({ ...devicePlayback, stopsAt });
  };

  const stopPlayback = () =>
    run(async () => {
      if (onDevice) return stopOnDevice();
      setStopPending(true);
      try {
        await stop({ groupId, startsAt: playback?.startsAt });
      } finally {
        setStopPending(false);
      }
    });

  const mute = () => setMutedStart(playback?.startsAt ?? null);
  const unmute = () => setMutedStart(null);
  const starterName = playback === null || onDevice ? null : playback.startedBy === viewer?.id ? "you" : playback.startedByName;
  const stopperName =
    playing || onDevice || playback === null || playback.stoppedBy === null || (selectedSongId !== null && selectedSongId !== playback.songId)
      ? null
      : playback.stoppedBy === viewer?.id
        ? "you"
        : playback.stoppedByName;

  const previousSong = neighbourSong(songOrder, startSongId, -1, orderAt);
  const nextSong = neighbourSong(songOrder, startSongId, 1, orderAt);
  const stepSong = (step: { item: Id<"songs">; at: number } | null) => {
    if (step === null) return;
    setSelectedSongId(step.item);
    setOrderAt(step.at);
  };

  const switchPlayMode = (toOffline: boolean) => {
    if (toOffline === offlinePlay || (playing && offlinePlay)) return;
    setDevicePlayback(null);
    setOfflinePlay(toOffline);
    if (!toOffline && !isAdmin) {
      setSelectedSongId(null);
      setStartPick(null);
    }
  };

  const tapSection = (index: number) => {
    if (!steers) return;
    if (playing) run(async () => (onDevice ? jumpOnDevice(index) : jump({ groupId, toSection: index, mode: jumpMode, startsAt: playback?.startsAt })));
    else if (startSongId) setStartPick({ songId: startSongId, index, bar: 1 });
  };

  const tapBar = (bar: number) => {
    if (steers && startSongId) setStartPick({ songId: startSongId, index: startSection, bar });
  };

  const pickedTitle =
    pickedSection !== null && startSong ? `${titleOf(startSong.sections[pickedSection])}${pickedBar ? `, bar ${pickedBar}` : ""}` : null;

  const onlineMembers: StageMember[] = (offline ? [] : (members ?? []))
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
      started: playing && !onDevice && member.userId === playback?.startedBy,
    }))
    .filter((member) => memberPresence(presence.rows, member.userId, presence.nowMs, viewer?.id) !== "offline");
  const startLabel = startHint ?? "Start";
  const songTempo = startSong ? (startSong.bpm ?? commonBpm(startSong.sections)) : null;
  const canChangeTempo = isAdmin && !playing && !unclocked && startBlocker === null && songTempo !== null;
  const tempoOpen = canChangeTempo && editingTempo !== null && editingTempo === startSongId;
  const songSpan = useMemo(() => (playing && playback && song.sections.length > 0 ? playbackSpan(song, playback) : null), [playing, playback, song]);
  const startLength = startSong ? songLengthMs({ countIn: pickedSection !== null || startSong.countIn, cueLeadBars: startSong.cueLeadBars, sections: startSong.sections }, startSection, startBar) : 0;

  const header = (
    <ScreenHeader
      title={screenTitle}
      subtitle={
        offline ? (
          "Just you, on this device"
        ) : group.joinCode ? (
          <JoinCodeActions code={group.joinCode} groupName={group.name} onDone={toast.show} />
        ) : isAdmin ? (
          "Admin"
        ) : (
          "Member"
        )
      }
      onBack={() => (playing && !leaving ? setAskLeave(true) : router.dismissTo("/"))}
      backLabel="Your Groups"
      backTestID="groups-back"
      right={
        <View style={styles.headerRight}>
          {tempo ? (
            <View testID="tempo" aria-label={`${tempo.time}, ${tempo.bpm}`} style={styles.tempoRow}>
              <ThemedText numberOfLines={1} style={styles.tempo}>
                {tempo.time}
              </ThemedText>
              <ThemedText numberOfLines={1} style={styles.tempo}>
                {tempo.bpm}
              </ThemedText>
            </View>
          ) : null}
          {offline ? null : (
            <View style={styles.pill}>
              <SignalBars roundTripMs={connected ? (estimate?.roundTripMs ?? null) : null} />
              <ThemedText type="caption" themeColor="textSecondary" testID="clock-status" numberOfLines={1} style={styles.pillText}>
                {!connected ? "Connecting…" : estimate ? `${Math.round(estimate.roundTripMs)} ms${estimate.roundTripMs > WEAK_PING_MS ? " weak" : ""}` : "Measuring…"}
              </ThemedText>
              <ThemedText type="caption" themeColor="textSecondary" testID="online-count" numberOfLines={1} style={[styles.pillText, styles.pillGap]}>
                {onlineMembers.length} online
              </ThemedText>
            </View>
          )}
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
      {offlinePlay ? (
        <View style={[styles.offlineBadge, { backgroundColor: theme.backgroundSelected }]} testID="offline-play-badge">
          <Icon name="person" size={14} color="textSecondary" />
          <ThemedText type="caption" themeColor="textSecondary">
            Offline play
          </ThemedText>
        </View>
      ) : null}
      {soundPromptFor("enable-sound")}
      {playing ? (
        <View style={[styles.stageHead, styles.titleBlock]}>
          <ThemedText testID="song-title" themeColor="textSecondary" style={[styles.centered, styles.playingSong]} numberOfLines={1}>
            {shownTitle ?? " "}
          </ThemedText>
          {starterName ? (
            <View style={styles.starter} testID="started-by">
              <Icon name="member" size={14} color="textSecondary" />
              <ThemedText type="caption" themeColor="textSecondary" numberOfLines={1} style={styles.starterName}>
                Started by {starterName}
              </ThemedText>
            </View>
          ) : null}
          <ThemedText
            type="title"
            testID="current-section"
            numberOfLines={1}
            style={[styles.centered, styles.sectionHeading, currentSection.length > 9 ? styles.sectionHeadingLong : null]}
          >
            {currentSection}
          </ThemedText>
          {beat ? <SectionProgress beat={beat} serverNow={playNow} /> : null}
        </View>
      ) : (
        <View style={[styles.stageHead, styles.titleBlock]}>
          <ThemedText type="title" testID="song-title" style={[styles.centered, styles.idleTitle]} numberOfLines={2}>
            {shownTitle ?? (steers ? "Pick a Song" : "Waiting for an Admin")}
          </ThemedText>
          {shownTitle && songFacts ? (
            <ThemedText type="small" themeColor="textSecondary" testID="song-facts" style={styles.centered}>
              {songFacts}
            </ThemedText>
          ) : null}
          {stopperName ? (
            <View style={styles.starter} testID="stopped-by">
              <Icon name="stop" size={14} color="textSecondary" />
              <ThemedText type="caption" themeColor="textSecondary" numberOfLines={1} style={styles.starterName}>
                Stopped by {stopperName}
              </ThemedText>
            </View>
          ) : null}
        </View>
      )}
      <View style={styles.stageRow}>
        <BeatPulse
          beat={beat}
          playing={playing}
          idle={idle}
          onPressIdle={canChangeTempo ? () => setEditingTempo(editingTempo === startSongId ? null : startSongId) : undefined}
          idleActionLabel={songTempo === null ? undefined : `Change the Song tempo, ${songTempo} BPM`}
        />
        <StageMembers members={offlinePlay ? [] : onlineMembers} beat={beat} playing={playing} visible={tab === "play"} />
      </View>
      {tempoOpen && startSong && songTempo !== null && startSongId ? (
        <TempoPanel
          key={startSongId}
          bpm={songTempo}
          ownTempoCount={startSong.sections.filter((section) => section.ownTempo === true || (startSong.bpm === null && section.bpm !== songTempo)).length}
          onSave={(bpm) => updateSong({ songId: startSongId, bpm }).then(() => undefined)}
          onClose={() => setEditingTempo(null)}
        />
      ) : null}
      {playing ? null : (
        <View style={styles.nextBlock}>
          {!steers ? (
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
      {playing && (steers || vampTitle !== null) ? (
        <View style={styles.vampBlock}>
          {vampTitle !== null ? (
            <ThemedText type="smallBold" themeColor="accent" testID="vamp-status" style={styles.centered}>
              {steers ? `Vamping ${vampTitle}` : `Vamping ${vampTitle} until an Admin ends it`}
            </ThemedText>
          ) : null}
          {steers ? (
            <View style={styles.vampButtons}>
              {vampTitle === null ? (
                <>
                  <ActionButton medium rounded icon="repeat" label="Repeat" testID="repeat-section" disabled={beat?.sectionIndex == null || stopping} onPress={() => repeatNow(false)} />
                  <ActionButton medium rounded icon="vamp" label="Vamp" testID="vamp-section" disabled={beat?.sectionIndex == null || stopping} onPress={() => repeatNow(true)} />
                </>
              ) : (
                <ActionButton medium rounded accent icon="vamp" label="End vamp" testID="end-vamp" disabled={stopping} onPress={endVampNow} />
              )}
            </View>
          ) : null}
        </View>
      ) : null}
      {shownSections.length > 0 ? (
        <Card title="Sections">
          <View style={styles.wrap}>
            {shownSections.map((section, index) => (
              <SectionChip
                key={index}
                label={shortTitleOf(section)}
                plays={playsOf(section)}
                accessibleName={playsOf(section) > 1 ? `${titleOf(section)}, plays ${playsOf(section)} times` : titleOf(section)}
                queued={playing && queuedSections.includes(index)}
                testID={`play-section-${index}`}
                selected={playing ? beat?.sectionIndex === index : steers && startSection === index && startBlocker === null}
                onPress={() => tapSection(index)}
              />
            ))}
          </View>
          {steers && !playing && startBlocker === null && startSectionBars > 1 ? (
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
          {steers ? (
            <>
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
      {offline ? null : (
        <Card title="Play mode">
          <Segmented
            label="Play mode"
            testID="play-mode"
            value={offlinePlay ? "offline" : "group"}
            disabled={playing && offlinePlay}
            onChange={(next) => switchPlayMode(next === "offline")}
            options={[
              { value: "group", label: "With the Group" },
              { value: "offline", label: "Offline" },
            ]}
          />
          {offlinePlay ? (
            <ThemedText type="caption" themeColor="textSecondary" testID="offline-play-note">
              {groupPlaying ? "The Group is playing now. Switch to With the Group to follow it." : "Only you hear this. The Group's Playback is not changed."}
            </ThemedText>
          ) : null}
        </Card>
      )}
    </View>
  );

  const showTab = (next: GroupTab) => {
    setTab(next);
    scroller.current?.scrollTo({ y: 0, animated: false });
  };

  const playSong = (songId: Id<"songs">) => {
    setSelectedSongId(songId);
    setPickedFromSetlist(false);
    setOrderAt(null);
    showTab("play");
  };

  const playSetlistSong = (songId: Id<"songs">, position: number, fromCurrentSetlist: boolean) => {
    setSelectedSongId(songId);
    setPickedFromSetlist(fromCurrentSetlist);
    setOrderAt(fromCurrentSetlist ? position : null);
    showTab("play");
  };

  const setlistTab = (
    <SetlistCard
      groupId={groupId}
      isAdmin={isAdmin}
      canPick={steers}
      selectedSongId={selectedSongId ?? playback?.songId ?? null}
      onSelect={playSetlistSong}
      run={run}
    />
  );

  const songsTab = (
    <>
      <SongsCard
        groupId={groupId}
        isAdmin={isAdmin}
        canPlay={steers}
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

  const copyName = copyTitle(copyBaseOf({ title: group.name, copyBase: group.copyBase }), groupNames, MAX_GROUP_NAME);
  const confirmDuplicate = async () => {
    if (duplicatePending) return;
    setDuplicateError(null);
    setDuplicatePending(true);
    const mine = ++attempt.current;
    try {
      const copy = await duplicateGroup({ groupId });
      if (mine !== attempt.current) {
        showToast(`${copy.name} is ready in Your Groups`);
        return;
      }
      setConfirmingDuplicate(false);
      if (playing) showToast(`${copy.name} is ready in Your Groups`);
      else router.replace({ pathname: "/group/[groupId]", params: { groupId: copy.groupId } });
    } catch (error) {
      if (mine !== attempt.current) showToast(errorText(error), "error");
      else setDuplicateError(errorText(error));
    } finally {
      setDuplicatePending(false);
    }
  };

  const confirmDelete = async () => {
    if (deletePending) return;
    setDeleteError(null);
    setDeletePending(true);
    setLeavingGroup(true);
    const mine = ++attempt.current;
    try {
      await deleteGroup({ groupId });
      router.dismissTo("/");
    } catch (error) {
      setLeavingGroup(false);
      if (mine !== attempt.current) showToast(errorText(error), "error");
      else setDeleteError(errorText(error));
    } finally {
      setDeletePending(false);
    }
  };

  const confirmLeave = async () => {
    if (leavingGroup) return;
    setLeaveError(null);
    setLeavingGroup(true);
    const mine = ++attempt.current;
    try {
      await leave({ groupId });
      router.dismissTo("/");
    } catch (error) {
      setLeavingGroup(false);
      if (mine !== attempt.current) showToast(errorText(error), "error");
      else setLeaveError(errorText(error));
    }
  };

  const groupTab = (
    <>
      <MembersCard groupId={groupId} groupName={group.name} isAdmin={isAdmin} presence={presence} />
      <View style={styles.leave}>
        {isAdmin ? <RenameGroup groupId={groupId} name={group.name} /> : null}
        {isAdmin ? (
          <ActionButton
            icon="copy"
            label="Duplicate Group"
            testID="duplicate-group"
            onPress={() => {
              setDuplicateError(null);
              setConfirmingDuplicate(true);
            }}
          />
        ) : null}
        <ActionButton
          variant="danger"
          icon="logout"
          label="Leave Group"
          testID="leave-group"
          onPress={() => {
            setLeaveError(null);
            setConfirmingLeave(true);
          }}
        />
        {isAdmin ? (
          <ActionButton
            variant="danger"
            icon="trash"
            label="Delete Group"
            testID="delete-group"
            onPress={() => {
              setDeleteError(null);
              setConfirmingDelete(true);
            }}
          />
        ) : null}
      </View>
    </>
  );

  const playCard =
    tab === "play" && (steers || songSpan !== null || startLength > 0) ? (
      <View style={[styles.floatCard, { backgroundColor: theme.background, borderColor: theme.border, shadowColor: theme.text }]} testID="play-controls">
        {steers ? (
          <View style={styles.transport}>
            {playing && !onDevice ? (
              <IconButton
                icon={muted ? "sound" : "muted"}
                label={muted ? "Unmute" : "Mute"}
                testID={muted ? "unmute" : "mute"}
                size={ControlHeight.large}
                round
                filled
                active={muted}
                onPress={muted ? unmute : mute}
              />
            ) : (
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
            )}
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
                pending={startPending}
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
        {playing && (!steers || muted) ? (
          <View style={styles.personal}>
            {muted ? (
              <ThemedText type="caption" themeColor="textSecondary" testID="muted-notice" style={styles.grow} numberOfLines={2}>
                Muted on this device. Playback carries on for everyone else.
              </ThemedText>
            ) : null}
            {steers ? null : (
              <ActionButton
                medium
                rounded
                full={!muted}
                accent={muted}
                icon={muted ? "sound" : "muted"}
                label={muted ? "Unmute" : "Mute"}
                testID={muted ? "unmute" : "mute"}
                onPress={muted ? unmute : mute}
              />
            )}
          </View>
        ) : null}
        <SongProgress span={songSpan} lengthMs={startLength} serverNow={playNow} />
      </View>
    ) : null;

  const miniCard =
    steers && tab !== "play" ? (
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
          <ActionButton medium rounded accent icon="play" label="Start" testID="start" disabled={startBlocker !== null} pending={startPending} onPress={startPlayback} />
        )}
      </View>
    ) : null;

  const floating = playCard ?? miniCard;

  return (
    <ThemedView style={styles.container}>
      {playing ? <KeepAwake /> : null}
      <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
        <PinnedHeader scrolled={pinned.scrolled}>{header}</PinnedHeader>
        <SwipeTabs tabs={tabIds} active={tab} onChange={showTab}>
        <ScrollView
          ref={scroller}
          contentContainerStyle={[styles.content, { paddingBottom: Spacing.five + (floating ? floatHeight : 0) }]}
          {...pinned.scrollProps}
        >
          {(
            [
              ["play", playTab],
              ["setlist", setlistTab],
              ["songs", songsTab],
              ["sound", soundTab],
              ["group", offline ? null : groupTab],
            ] as const
          ).map(([pane, content]) => (
            <View key={pane} role="tabpanel" id={panelId(pane)} aria-labelledby={tabId(pane)} style={tab === pane ? styles.tabPane : styles.hidden}>
              {content}
            </View>
          ))}
        </ScrollView>
        </SwipeTabs>
        {floating ? (
          <View pointerEvents="box-none" style={[styles.floatLayer, { bottom: dockHeight }]} onLayout={(event) => setFloatHeight(event.nativeEvent.layout.height)}>
            {floating}
          </View>
        ) : null}
        <View style={[styles.dock, { backgroundColor: theme.background, borderTopColor: theme.border, paddingBottom: dockInset }]} onLayout={(event) => setDockHeight(event.nativeEvent.layout.height)}>
          <TabBar tabs={tabs} active={tab} onChange={showTab} />
        </View>
      </SafeAreaView>
      <Toast message={toast.message} bottom={dockHeight + (floating ? floatHeight : 0) + Spacing.two} />
      <ConfirmDialog
        visible={confirmingDuplicate}
        title={`Duplicate ${group.name}?`}
        message={`${copyName} gets copies of ${countOf(library?.length ?? 0, "Song")} and ${countOf(setlists?.length ?? 0, "Setlist")}. You will be its only Member, as Admin, with a new join code.`}
        confirmLabel="Duplicate"
        pending={duplicatePending}
        error={duplicateError}
        onConfirm={() => void confirmDuplicate()}
        onCancel={() => {
          attempt.current += 1;
          setConfirmingDuplicate(false);
        }}
        testID="duplicate-group-dialog"
      />
      <ConfirmDialog
        visible={confirmingDelete}
        title={`Delete ${group.name}?`}
        message={`${countOf(library?.length ?? 0, "Song")}, ${countOf(setlists?.length ?? 0, "Setlist")} and every Member go with it, for everyone, and the join code stops working. This cannot be undone.`}
        confirmLabel="Delete"
        pending={deletePending}
        error={deleteError}
        onConfirm={() => void confirmDelete()}
        onCancel={() => {
          attempt.current += 1;
          setConfirmingDelete(false);
        }}
        testID="delete-group-dialog"
      />
      <ConfirmDialog
        visible={confirmingLeave}
        title={`Leave ${group.name}?`}
        message={isAdmin ? "You will need the join code to come back, and the Group needs another Admin if you are the last one." : "You will need the join code to come back."}
        confirmLabel="Leave"
        pending={leavingGroup}
        error={leaveError}
        onConfirm={() => void confirmLeave()}
        onCancel={() => {
          attempt.current += 1;
          setConfirmingLeave(false);
        }}
        testID="leave-group-dialog"
      />
      <ConfirmDialog
        visible={askLeave && !leaving}
        title="Leave Playback?"
        message={
          onDevice
            ? "The Click and Voice cues stop."
            : isAdmin
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
    paddingTop: PINNED_CONTENT_TOP,
    paddingBottom: Spacing.five,
    maxWidth: MaxContentWidth,
    alignSelf: "center",
    width: "100%",
  },
  headerRight: { alignItems: "flex-end", flexShrink: 0 },
  tempo: { fontSize: 15, lineHeight: 20, fontWeight: 700, fontVariant: ["tabular-nums"] },
  tempoRow: { flexDirection: "row", gap: Spacing.two },
  pill: { flexDirection: "row", alignItems: "center", gap: Spacing.one, height: 24 },
  pillText: { fontSize: 13, fontWeight: 500, fontVariant: ["tabular-nums"] },
  pillGap: { marginLeft: Spacing.one },
  stageHead: { alignItems: "center", gap: Spacing.one, width: "100%" },
  playColumn: { width: "100%", alignItems: "center", gap: Spacing.three },
  offlineBadge: { flexDirection: "row", alignItems: "center", gap: Spacing.one, paddingHorizontal: Spacing.two + 2, minHeight: 26, borderRadius: Radius.pill },
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
  leave: { width: "100%", paddingTop: Spacing.two, alignItems: "center", gap: Spacing.two },
  vampBlock: { width: "100%", alignItems: "center", gap: Spacing.two },
  vampButtons: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: Spacing.two },
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
  personal: { flexDirection: "row", alignItems: "center", gap: Spacing.three, width: "100%", paddingLeft: Spacing.one },
  starter: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: Spacing.one, maxWidth: "100%" },
  starterName: { flexShrink: 1 },
  transport: { flexDirection: "row", alignItems: "center", gap: Spacing.two, width: "100%" },
  backButton: { paddingHorizontal: Spacing.four, paddingVertical: Spacing.three, borderRadius: Radius.md },
});
