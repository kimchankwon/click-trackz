import { useMutation, useQuery } from "convex/react";
import { useKeepAwake } from "expo-keep-awake";
import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
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
import { useDeviceSetting } from "@/settings/use-device-setting";
import { demoSong } from "@/sync/demo-song";
import { beatsBetween, type Beat, type Playback, type Section } from "@/sync/timeline";
import { useServerClock } from "@/sync/use-server-clock";
import { api } from "../../convex/_generated/api";

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

export default function PlaybackScreen() {
  const { estimate, serverNow } = useServerClock();
  const playback = useQuery(api.playback.current, {}) as Playback | null | undefined;
  const start = useMutation(api.playback.start);
  const jump = useMutation(api.playback.jump);
  const stop = useMutation(api.playback.stop);
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
    engine.current?.setPlan(demoSong, playback ?? null);
  }, [playback, soundOn]);

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
      if (now !== null && playback) {
        const recent = beatsBetween(demoSong, playback, now - 10_000, now + 1);
        const ahead = beatsBetween(demoSong, playback, now, now + 60 * 60_000);
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
  }, [serverNow, playback]);

  const run = useCallback((action: () => Promise<unknown>) => {
    setError(null);
    action().catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
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

  const currentSection = playing && beat ? (beat.sectionIndex === null ? "COUNT-IN" : labelOf(demoSong.sections[beat.sectionIndex])) : "READY";

  return (
    <ThemedView style={styles.container}>
      {playing ? <KeepAwake /> : null}
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.header}>
            <ThemedText type="smallBold">Demo Song</ThemedText>
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

          <View style={styles.row}>
            <TransportButton label="Start" testID="start" primary onPress={() => run(() => start({}))} />
            <TransportButton label="Stop" testID="stop" onPress={() => run(() => stop({}))} />
          </View>

          <Card title="SECTIONS">
            <View style={styles.wrap}>
              {demoSong.sections.map((section, index) => (
                <Chip
                  key={index}
                  role="button"
                  label={labelOf(section)}
                  selected={playing && beat?.sectionIndex === index}
                  onPress={() => run(() => jump({ toSection: index, mode: jumpMode }))}
                />
              ))}
            </View>
            <View style={styles.wrap}>
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
          {error ? <ThemedText themeColor="textSecondary">{error}</ThemedText> : null}
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
  card: { width: "100%", gap: Spacing.three, padding: Spacing.three, borderWidth: 1, borderRadius: Spacing.four },
});
