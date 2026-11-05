import { useMutation, useQuery } from "convex/react";
import { useKeepAwake } from "expo-keep-awake";
import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { CueAudioEngine, type CueMix } from "@/audio/engine";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { MaxContentWidth, Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { demoSong } from "@/sync/demo-song";
import { beatsBetween, type Beat, type Playback, type Section } from "@/sync/timeline";
import { useServerClock } from "@/sync/use-server-clock";
import { api } from "../../convex/_generated/api";

type JumpMode = "endOfSection" | "nextBar";

const labelOf = (section: Pick<Section, "sectionType" | "number">) =>
  `${section.sectionType.toUpperCase()}${section.number ?? ""}`;

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

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (next: boolean) => void }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      onPress={() => onChange(!value)}
      style={[styles.chip, { backgroundColor: value ? theme.backgroundSelected : theme.backgroundElement }]}
    >
      <ThemedText type="small" themeColor={value ? "text" : "textSecondary"}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

function Button({ label, onPress, testID }: { label: string; onPress: () => void; testID?: string }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      testID={testID}
      onPress={onPress}
      style={[styles.button, { backgroundColor: theme.backgroundElement }]}
    >
      <ThemedText>{label}</ThemedText>
    </Pressable>
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

  useEffect(() => () => engine.current?.dispose(), []);

  useEffect(() => {
    let handle = 0;
    const draw = () => {
      const now = serverNow();
      if (now !== null && playback) {
        const recent = beatsBetween(demoSong, playback, now - 10_000, now + 1);
        const ahead = beatsBetween(demoSong, playback, now, now + 60 * 60_000);
        setBeat(recent.at(-1) ?? null);
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

  const run = (action: () => Promise<unknown>) => {
    setError(null);
    action().catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  };

  const enableSound = () =>
    run(async () => {
      engine.current ??= new CueAudioEngine();
      await engine.current.enable(serverNow);
      setSoundOn(true);
    });

  const nextLine = upcoming ? `next: ${labelOf(upcoming)}` : "";

  return (
    <ThemedView style={[styles.container, beat?.accent ? { backgroundColor: theme.backgroundSelected } : null]}>
      {playing ? <KeepAwake /> : null}
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content}>
          <ThemedText type="small" themeColor="textSecondary" testID="clock-status">
            {estimate ? `clock ±${estimate.uncertaintyMs.toFixed(0)} ms` : "Measuring clock…"}
          </ThemedText>
          <ThemedText type="title" testID="playback-count" style={styles.count}>
            {playing && beat ? beat.count : "–"}
          </ThemedText>
          <ThemedText type="subtitle" testID="playback-next">
            {playing ? nextLine : ""}
          </ThemedText>

          {soundOn ? (
            <View style={styles.row}>
              <Toggle label="Click" value={mix.click} onChange={(click) => setMix({ ...mix, click })} />
              <Toggle label="Voice cues" value={mix.voiceCues} onChange={(voiceCues) => setMix({ ...mix, voiceCues })} />
              <Toggle
                label="Spoken counts"
                value={mix.spokenCounts}
                onChange={(spokenCounts) => setMix({ ...mix, spokenCounts })}
              />
            </View>
          ) : (
            <Button label="Enable sound" testID="enable-sound" onPress={enableSound} />
          )}

          <View style={styles.row}>
            <Button label="Start" testID="start" onPress={() => run(() => start({}))} />
            <Button label="Stop" testID="stop" onPress={() => run(() => stop({}))} />
          </View>

          <ThemedText type="smallBold">Jump</ThemedText>
          <View style={styles.row}>
            <Toggle
              label="End of Section"
              value={jumpMode === "endOfSection"}
              onChange={() => setJumpMode("endOfSection")}
            />
            <Toggle label="Next bar" value={jumpMode === "nextBar"} onChange={() => setJumpMode("nextBar")} />
          </View>
          <View style={styles.row}>
            {demoSong.sections.map((section, index) => (
              <Button
                key={index}
                label={labelOf(section)}
                onPress={() => run(() => jump({ toSection: index, mode: jumpMode }))}
              />
            ))}
          </View>
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
  count: { fontSize: 112, lineHeight: 124, marginVertical: Spacing.four },
  row: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.two, justifyContent: "center" },
  button: { paddingHorizontal: Spacing.four, paddingVertical: Spacing.three, borderRadius: Spacing.three },
  chip: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, borderRadius: Spacing.five },
});
