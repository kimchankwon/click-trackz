import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { CueAudioEngine } from "@/audio/engine";
import { nudgeFromTapTest, tapOffsets, type TapRound } from "@/audio/tap-test";
import { VolumeBar } from "@/components/playback/volume-bar";
import { ActionButton } from "@/components/action-button";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Icon } from "@/components/ui/icon";
import { ScreenHeader } from "@/components/ui/screen-header";
import { Fonts, MaxContentWidth, Radius, Spacing } from "@/constants/theme";
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

function RoundBadge({ n, muted }: { n: number; muted?: boolean }) {
  const theme = useTheme();
  return (
    <View style={[styles.roundBadge, { backgroundColor: muted ? theme.textTertiary : theme.accent }]}>
      <ThemedText type="smallBold" themeColor={muted ? "background" : "onAccent"} style={styles.roundBadgeText}>
        {n}
      </ThemedText>
    </View>
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
  const roundBusy = useRef(false);
  const [speakerDone, setSpeakerDone] = useState(false);
  const [step, setStep] = useState<Step>("idle");
  const [listening, setListening] = useState(false);
  const [tapCount, setTapCount] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [chosenPreset, setChosenPreset] = useState<string | null>(null);

  useEffect(
    () => () => {
      if (roundTimer.current) clearTimeout(roundTimer.current);
      engine.current?.dispose();
    },
    [],
  );

  const setNudge = (ms: number) => setStored(String(clampLatency(ms)));

  const startRound = async (next: "speaker" | "output") => {
    if (roundBusy.current) return;
    roundBusy.current = true;
    if (next === "speaker") {
      speakerRound.current = null;
      setSpeakerDone(false);
    }
    let started: ReturnType<CueAudioEngine["tapTestRound"]>;
    try {
      if (!engine.current) engine.current = new CueAudioEngine();
      await engine.current.enable(() => null, null);
      started = engine.current.tapTestRound(CLICKS, INTERVAL_MS);
    } catch (error) {
      roundBusy.current = false;
      throw error;
    }
    const { clickTimesMs, reportedLatencyMs, lastClickInMs } = started;
    round.current = { clickTimesMs, reportedLatencyMs, taps: [] };
    setTapCount(0);
    setStep(next);
    setListening(true);
    roundTimer.current = setTimeout(() => finishRound(next), lastClickInMs + ROUND_TAIL_MS);
  };

  const finishRound = (finished: "speaker" | "output") => {
    roundTimer.current = null;
    roundBusy.current = false;
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
      <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
        <ScrollView contentContainerStyle={styles.content}>
          <ScreenHeader title="Latency nudge" subtitle="This phone only" onBack={() => router.back()} backTestID="latency-back" />
          <ThemedText themeColor="textSecondary" style={styles.intro}>
            Bluetooth headphones and some speakers play sound late. The nudge schedules your Click and Voice cues earlier so
            they line up with everyone else.
          </ThemedText>

          <View style={[styles.panel, { backgroundColor: theme.backgroundElement }]}>
            <View style={styles.readout}>
              <ThemedText style={[styles.readoutValue, { color: theme.text }]}>{nudge}</ThemedText>
              <ThemedText themeColor="textSecondary" style={styles.readoutUnit}>
                ms
              </ThemedText>
            </View>
            <ThemedText type="caption" themeColor="textSecondary" style={styles.centered}>
              {nudge === 0 ? "No nudge" : nudge > 0 ? "Sounds play this much earlier" : "Sounds play this much later"}
            </ThemedText>
            <VolumeBar
              label="Nudge"
              testID="latency-bar"
              accessibleName="Latency nudge"
              accessibleRange={{ min: LATENCY_MIN_MS, max: LATENCY_MAX_MS, now: nudge }}
              value={(nudge - LATENCY_MIN_MS) / (LATENCY_MAX_MS - LATENCY_MIN_MS)}
              valueText={`${nudge} ms`}
              hideValue
              bare
              onChange={(fraction) => setNudge(LATENCY_MIN_MS + fraction * (LATENCY_MAX_MS - LATENCY_MIN_MS))}
            />
            <View style={styles.steps}>
              {[-10, -1, 1, 10].map((step) => (
                <View key={step} style={styles.stepCell}>
                  <ActionButton full medium label={step > 0 ? `+${step}` : String(step)} testID={`nudge-${step}`} onPress={() => setNudge(nudge + step)} />
                </View>
              ))}
            </View>
          </View>

          <View style={styles.group}>
            <ThemedText type="label" themeColor="textSecondary" role="heading" style={styles.groupLabel}>
              Quick presets
            </ThemedText>
            <View style={styles.presets}>
              {latencyPresets.map((preset) => {
                const matching = latencyPresets.filter((p) => p.ms === nudge);
                const selected =
                  preset.ms === nudge && (matching.some((p) => p.label === chosenPreset) ? preset.label === chosenPreset : matching[0] === preset);
                return (
                  <Pressable
                    key={preset.label}
                    testID={`preset-${preset.label}`}
                    role="radio"
                    aria-checked={selected}
                    onPress={() => {
                      setChosenPreset(preset.label);
                      setNudge(preset.ms);
                    }}
                    style={[
                      styles.preset,
                      { backgroundColor: selected ? theme.accentTint : theme.backgroundElement, borderColor: selected ? theme.accent : "transparent" },
                    ]}
                  >
                    <View style={styles.presetTop}>
                      <ThemedText type="smallBold" themeColor={selected ? "accent" : "text"} style={styles.grow}>
                        {preset.label}
                      </ThemedText>
                      {selected ? <Icon name="check" size={18} color="accent" /> : null}
                    </View>
                    <ThemedText type="smallBold" themeColor="textSecondary" style={styles.tabular}>
                      {preset.ms} ms
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.group}>
            <ThemedText type="label" themeColor="textSecondary" role="heading" style={styles.groupLabel}>
              Tap to measure
            </ThemedText>
            <View style={[styles.panel, { backgroundColor: theme.backgroundElement }]}>
              <View style={styles.roundStep}>
                <View style={[styles.stepBadge, { backgroundColor: speakerDone ? theme.accent : theme.backgroundSelected }]}>
                  <ThemedText type="smallBold" themeColor={speakerDone ? "onAccent" : "text"}>
                    1
                  </ThemedText>
                </View>
                <ThemedText type="small" style={styles.grow}>
                  Play through the phone speaker and tap the pad on every click.
                </ThemedText>
              </View>
              <View style={styles.roundStep}>
                <View style={[styles.stepBadge, { backgroundColor: theme.backgroundSelected }]}>
                  <ThemedText type="smallBold">2</ThemedText>
                </View>
                <ThemedText type="small" style={styles.grow}>
                  Switch to the headphones or speakers you will play with and do the same. Only the difference counts, so your
                  reaction time cancels out.
                </ThemedText>
              </View>
              <View style={styles.steps}>
                <View style={styles.stepCell}>
                  <ActionButton full medium variant={speakerDone ? "quiet" : "selected"} leading={<RoundBadge n={1} muted={speakerDone} />} label="Round 1" accessibleName="Round 1: phone speaker" testID="round-speaker" onPress={() => run(() => startRound("speaker"))} />
                </View>
                <View style={styles.stepCell}>
                  <ActionButton
                    full
                    medium
                    variant={speakerDone ? "selected" : "quiet"}
                    leading={<RoundBadge n={2} muted={!speakerDone} />}
                    label="Round 2"
                    accessibleName="Round 2: your output"
                    testID="round-output"
                    disabled={!speakerDone}
                    onPress={() => run(() => startRound("output"))}
                  />
                </View>
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
                style={[
                  styles.pad,
                  listening ? { backgroundColor: theme.accent, borderColor: theme.accent } : { backgroundColor: theme.inputFill, borderColor: theme.inputBorder },
                ]}
              >
                <Icon name="touch" size={36} color={listening ? "onAccent" : "textTertiary"} />
                <ThemedText type="heading" themeColor={listening ? "onAccent" : "textSecondary"}>
                  {listening ? `Tap on every click · ${tapCount}` : "Tap pad"}
                </ThemedText>
                {listening ? (
                  <ThemedText type="caption" themeColor="onAccent">
                    {step === "speaker" ? "Round 1, phone speaker" : "Round 2, your output"}
                  </ThemedText>
                ) : null}
              </Pressable>
            </View>
          </View>
          {message ? (
            <ThemedText testID="latency-message" type="small" themeColor="textSecondary">
              {message}
            </ThemedText>
          ) : null}
          {nudgeUnsaved ? (
            <ThemedText testID="setting-unsaved" type="small" themeColor="textSecondary">
              This device could not save your Latency nudge, so it will reset when you reopen the app.
            </ThemedText>
          ) : null}
        </ScrollView>
        <View style={[styles.dock, { backgroundColor: theme.background, borderTopColor: theme.border }]}>
          <ActionButton large full accent icon="check" label="Done" testID="latency-done" onPress={() => router.back()} />
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    gap: Spacing.four,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.five,
    maxWidth: MaxContentWidth,
    alignSelf: "center",
    width: "100%",
  },
  group: { gap: Spacing.two },
  groupLabel: { paddingHorizontal: Spacing.one },
  panel: { gap: Spacing.three, padding: Spacing.three, borderRadius: Radius.lg },
  readout: { flexDirection: "row", alignItems: "baseline", justifyContent: "center", gap: Spacing.two },
  readoutValue: { fontFamily: Fonts.condensed, fontSize: 72, lineHeight: 78, fontWeight: "700", fontVariant: ["tabular-nums"] },
  readoutUnit: { fontFamily: Fonts.display, fontSize: 24, lineHeight: 30, fontWeight: "700" },
  presetTop: { flexDirection: "row", alignItems: "center", gap: Spacing.two },
  centered: { textAlign: "center" },
  steps: { flexDirection: "row", gap: Spacing.two },
  stepCell: { flex: 1, flexDirection: "row" },
  presets: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.two },
  preset: { width: "48.5%", flexGrow: 1, gap: 2, padding: Spacing.three, borderRadius: Radius.md, borderWidth: 1.5, minHeight: 64 },
  tabular: { fontVariant: ["tabular-nums"] },
  roundStep: { flexDirection: "row", gap: Spacing.three, alignItems: "flex-start" },
  stepBadge: { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  grow: { flex: 1, minWidth: 0 },
  intro: { fontSize: 15, lineHeight: 22, fontWeight: 400 },
  roundBadge: { width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  roundBadgeText: { fontSize: 12, lineHeight: 14 },
  pad: { height: 200, borderRadius: Radius.lg, borderWidth: 2, alignItems: "center", justifyContent: "center", gap: Spacing.two },
  dock: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: Spacing.four, paddingVertical: Spacing.three },
});
