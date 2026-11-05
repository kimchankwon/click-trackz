import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { CueAudioEngine } from "@/audio/engine";
import { nudgeFromTapTest, tapOffsets, type TapRound } from "@/audio/tap-test";
import { VolumeBar } from "@/components/playback/volume-bar";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { MaxContentWidth, Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { errorText } from "@/lib/error-text";
import { clampLatency, isLatencySetting, LATENCY_MAX_MS, LATENCY_MIN_MS, latencyPresets } from "@/settings/latency";
import { useDeviceSetting } from "@/settings/use-device-setting";

const CLICKS = 10;
const INTERVAL_MS = 1_000;
const WARM_UP_CLICKS = 2;
const ROUND_TAIL_MS = 900;

type Step = "idle" | "speaker" | "output" | "done";

const ignorePress = () => undefined;

function Button({ label, onPress, testID, accent }: { label: string; onPress: () => void; testID?: string; accent?: boolean }) {
  const theme = useTheme();
  return (
    <Pressable
      role="button"
      testID={testID}
      onPress={onPress}
      style={[styles.button, { backgroundColor: accent ? theme.accent : theme.backgroundElement }]}
    >
      <ThemedText style={accent ? styles.onAccent : null}>{label}</ThemedText>
    </Pressable>
  );
}

export default function LatencyScreen() {
  const theme = useTheme();
  const [stored, setStored, nudgeUnsaved] = useDeviceSetting("latencyNudgeMs", "0", isLatencySetting);
  const nudge = Number(stored);
  const engine = useRef<CueAudioEngine | null>(null);
  const round = useRef<{ clickTimesMs: number[]; reportedLatencyMs: number; taps: number[] } | null>(null);
  const speakerRound = useRef<TapRound | null>(null);
  const roundTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [speakerDone, setSpeakerDone] = useState(false);
  const [step, setStep] = useState<Step>("idle");
  const [listening, setListening] = useState(false);
  const [tapCount, setTapCount] = useState(0);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(
    () => () => {
      if (roundTimer.current) clearTimeout(roundTimer.current);
      engine.current?.dispose();
    },
    [],
  );

  const setNudge = (ms: number) => setStored(String(clampLatency(ms)));

  const startRound = async (next: "speaker" | "output") => {
    if (roundTimer.current) clearTimeout(roundTimer.current);
    if (next === "speaker") {
      speakerRound.current = null;
      setSpeakerDone(false);
    }
    if (!engine.current) engine.current = new CueAudioEngine();
    await engine.current.enable(() => null, null);
    const { clickTimesMs, reportedLatencyMs, lastClickInMs } = engine.current.tapTestRound(CLICKS, INTERVAL_MS);
    round.current = { clickTimesMs, reportedLatencyMs, taps: [] };
    setTapCount(0);
    setStep(next);
    setListening(true);
    roundTimer.current = setTimeout(() => finishRound(next), lastClickInMs + ROUND_TAIL_MS);
  };

  const finishRound = (finished: "speaker" | "output") => {
    roundTimer.current = null;
    setListening(false);
    engine.current?.endTapTest();
    const current = round.current;
    if (!current) return;
    const result: TapRound = {
      tapOffsetsMs: tapOffsets(current.clickTimesMs, current.taps, WARM_UP_CLICKS),
      reportedLatencyMs: current.reportedLatencyMs,
    };
    if (finished === "speaker") {
      speakerRound.current = result;
      setSpeakerDone(true);
      setMessage(`Got ${result.tapOffsetsMs.length} taps. Now switch to your headphones or speakers and do round 2.`);
      return;
    }
    const measured = speakerRound.current ? nudgeFromTapTest(speakerRound.current, result) : null;
    speakerRound.current = null;
    setSpeakerDone(false);
    if (measured === null) {
      setMessage("The taps were too few or too uneven to measure. Start again from round 1, tapping on every click.");
      setStep("idle");
      return;
    }
    const stored = clampLatency(measured);
    setNudge(stored);
    setStep("done");
    setMessage(
      stored === measured
        ? `Measured ${measured} ms. Your Latency nudge is set.`
        : `Measured ${measured} ms, beyond the ${LATENCY_MIN_MS} to ${LATENCY_MAX_MS} ms range, so your Latency nudge is set to ${stored} ms.`,
    );
  };

  const run = (action: () => Promise<unknown>) => {
    setMessage(null);
    action().catch((e: unknown) => setMessage(errorText(e)));
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.content}>
          <ThemedText type="subtitle">Latency nudge</ThemedText>
          <ThemedText themeColor="textSecondary">
            Bluetooth headphones and some speakers play sound late. The nudge schedules your Click and Voice cues earlier so
            they line up with everyone else.
          </ThemedText>

          <ThemedText type="smallBold" themeColor="textSecondary">
            QUICK PRESETS
          </ThemedText>
          <View style={styles.wrap}>
            {latencyPresets.map((preset) => (
              <Pressable
                key={preset.label}
                role="button"
                testID={`preset-${preset.label}`}
                onPress={() => setNudge(preset.ms)}
                style={[styles.chip, { backgroundColor: theme.backgroundElement }]}
              >
                <ThemedText type="small">
                  {preset.label} · {preset.ms} ms
                </ThemedText>
              </Pressable>
            ))}
          </View>

          <VolumeBar
            label="Nudge"
            testID="latency-bar"
            accessibleName="Latency nudge"
            accessibleRange={{ min: LATENCY_MIN_MS, max: LATENCY_MAX_MS, now: nudge }}
            value={(nudge - LATENCY_MIN_MS) / (LATENCY_MAX_MS - LATENCY_MIN_MS)}
            valueText={`${nudge} ms`}
            onChange={(fraction) => setNudge(LATENCY_MIN_MS + fraction * (LATENCY_MAX_MS - LATENCY_MIN_MS))}
          />
          <View style={styles.wrap}>
            {[-10, -1, 1, 10].map((step) => (
              <Button key={step} label={step > 0 ? `+${step}` : String(step)} testID={`nudge-${step}`} onPress={() => setNudge(nudge + step)} />
            ))}
          </View>

          <ThemedText type="smallBold" themeColor="textSecondary">
            TAP TO MEASURE
          </ThemedText>
          <ThemedText themeColor="textSecondary">
            Round 1: play through the phone speaker and tap the big pad on every click. Round 2: switch to the headphones or
            speakers you will play with and do the same. Only the difference counts, so your own reaction time cancels out.
          </ThemedText>
          <View style={styles.wrap}>
            <Button label="Round 1: phone speaker" testID="round-speaker" onPress={() => run(() => startRound("speaker"))} />
            {speakerDone ? (
              <Button label="Round 2: your output" testID="round-output" accent onPress={() => run(() => startRound("output"))} />
            ) : null}
          </View>
          <Pressable
            role="button"
            testID="tap-pad"
            onPress={ignorePress}
            onPressIn={() => {
              if (!listening || !round.current) return;
              round.current.taps.push(performance.now());
              setTapCount(round.current.taps.length);
            }}
            style={[styles.pad, { backgroundColor: listening ? theme.accent : theme.backgroundElement }]}
          >
            <ThemedText type="subtitle" style={listening ? styles.onAccent : null}>
              {listening ? `Tap on every click (${step === "speaker" ? "round 1" : "round 2"}) · ${tapCount}` : "Tap pad"}
            </ThemedText>
          </Pressable>
          {message ? (
            <ThemedText testID="latency-message" themeColor="textSecondary">
              {message}
            </ThemedText>
          ) : null}
          {nudgeUnsaved ? (
            <ThemedText testID="setting-unsaved" themeColor="textSecondary">
              This device could not save your Latency nudge, so it will reset when you reopen the app.
            </ThemedText>
          ) : null}
          <Button label="Done" testID="latency-done" onPress={() => router.back()} />
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { gap: Spacing.three, padding: Spacing.four, maxWidth: MaxContentWidth, alignSelf: "center", width: "100%" },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.two },
  chip: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, borderRadius: Spacing.five },
  button: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, borderRadius: Spacing.three },
  onAccent: { color: "#FFFFFF" },
  pad: { height: 160, borderRadius: Spacing.four, alignItems: "center", justifyContent: "center" },
});
