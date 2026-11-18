import { usePreventRemove } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useReportedOutputLatency } from "@/audio/use-reported-output-latency";
import { useTimingTest } from "@/audio/use-timing-test";
import { ActionButton } from "@/components/action-button";
import { VolumeBar } from "@/components/playback/volume-bar";
import { TimingStrip } from "@/components/sound/timing-strip";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Icon } from "@/components/ui/icon";
import { PinnedHeader, PINNED_CONTENT_TOP, usePinnedHeader } from "@/components/ui/pinned-header";
import { ScreenHeader } from "@/components/ui/screen-header";
import { useDockInset } from "@/components/ui/use-dock-inset";
import { Fonts, MaxContentWidth, Radius, Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { backOr } from "@/lib/back-or";
import { errorText } from "@/lib/error-text";
import { earlyLateText } from "@/lib/timing-strip";
import { MIN_TAPS, nudgeFromSteps, steadyOffset, type TapStep } from "@/lib/timing-test";
import { clampLatency, isLatencySetting, LATENCY_MAX_MS, nudgeFromShown, nudgeShown, nudgeText, SHOWN_NUDGE_MAX_MS, SHOWN_NUDGE_MIN_MS, signedMs } from "@/settings/latency";
import { useDeviceSetting } from "@/settings/use-device-setting";

const TEST_INTERVAL_MS = 1_000;
const STRIP_RANGE_MS = TEST_INTERVAL_MS / 2;
const TEST_VOLUMES = { click: 0.8, voice: 0 };
const MEASURE_NUDGE_MS = 0;

const SAME_OUTPUT_MS = 30;
const BUILT_IN_MAX_REPORTED_MS = 60;

type Mode = "check" | "builtIn" | "output";
type BuiltInStep = TapStep & { reportedMs: number };

const ignorePress = () => undefined;

export default function LatencyScreen() {
  const theme = useTheme();
  const pinned = usePinnedHeader();
  const dockInset = useDockInset(Spacing.three);
  const [stored, setStored, nudgeUnsaved] = useDeviceSetting("latencyNudgeMs", "0", isLatencySetting);
  const saved = Number(stored);
  const [draft, setDraft] = useState<number | null>(null);
  const nudge = draft ?? saved;
  const shown = nudgeShown(nudge);
  const changed = draft !== null && draft !== saved;
  const [askLeave, setAskLeave] = useState(false);
  const [leaving, setLeaving] = useState(false);
  usePreventRemove(changed && !leaving, () => setAskLeave(true));
  useEffect(() => {
    if (leaving) backOr("/");
  }, [leaving]);
  const [mode, setMode] = useState<Mode | null>(null);
  const [offsets, setOffsets] = useState<number[]>([]);
  const [builtIn, setBuiltIn] = useState<BuiltInStep | null>(null);
  const [outputTaps, setOutputTaps] = useState<number[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const reported = useReportedOutputLatency();
  const recommended = clampLatency(reported ?? 0);
  const test = useTimingTest();
  const testedNudge = mode === "check" ? (test.tested?.latencyNudgeMs ?? nudge) : nudge;
  const measuring = mode === "builtIn" || mode === "output";
  const tapped: TapStep = { offsetsMs: offsets, nudgeMs: MEASURE_NUDGE_MS, intervalMs: TEST_INTERVAL_MS };
  const estimate = mode === "output" && builtIn ? nudgeFromSteps(builtIn, tapped, builtIn.reportedMs) : null;
  const lean = mode === "builtIn" ? steadyOffset(offsets, TEST_INTERVAL_MS) : null;
  const sameOutput = builtIn !== null && reported !== null && Math.abs(reported - builtIn.reportedMs) < SAME_OUTPUT_MS;
  const notBuiltIn = builtIn === null && mode !== "output" && reported !== null && reported > BUILT_IN_MAX_REPORTED_MS;

  const saveAttempt = useRef(0);
  const setNudge = (ms: number) => {
    saveAttempt.current += 1;
    const next = clampLatency(ms);
    setDraft(next);
    if (mode === "check") test.retune({ latencyNudgeMs: next, voiceOffsetMs: 0 });
  };
  const saveAndLeave = async () => {
    const mine = ++saveAttempt.current;
    test.stop();
    setMode(null);
    const kept = await setStored(String(nudge));
    if (saveAttempt.current !== mine) return;
    if (kept) setLeaving(true);
    else setAskLeave(false);
  };
  const discardAndLeave = () => {
    test.stop();
    setLeaving(true);
  };

  const begin = (next: Mode) => {
    setMessage(null);
    setOffsets([]);
    if (next === "builtIn") {
      setBuiltIn(null);
      setOutputTaps([]);
    }
    if (next === "output") setOutputTaps([]);
    setMode(next);
    test.start({ intervalMs: TEST_INTERVAL_MS, latencyNudgeMs: next === "check" ? nudge : MEASURE_NUDGE_MS, voiceOffsetMs: 0, volumes: TEST_VOLUMES }).catch((error: unknown) => {
      setMode(null);
      setMessage(errorText(error));
    });
  };

  const end = () => {
    if (mode === "builtIn") {
      if (steadyOffset(offsets, TEST_INTERVAL_MS) === null) setMessage(`Tap steadily on at least ${MIN_TAPS} clicks, then stop step 1.`);
      else {
        setBuiltIn({ ...tapped, reportedMs: reported ?? 0 });
        setMessage("Step 1 done. Connect your Bluetooth headphones or speaker, then start step 2.");
      }
    }
    if (mode === "output" && builtIn) {
      setOutputTaps(offsets);
      const measured = nudgeFromSteps(builtIn, tapped, builtIn.reportedMs);
      if (measured === null) setMessage(`Tap steadily on at least ${MIN_TAPS} clicks, then press Stop and set again.`);
      else {
        const kept = clampLatency(measured);
        setNudge(kept);
        const next = kept === saved ? "That is your saved nudge already." : "Press Save to keep it.";
        setMessage(
          kept === measured
            ? `Measured ${nudgeText(measured)} with your tapping lean removed. ${next}`
            : `Measured ${nudgeText(measured)}, beyond the ${signedMs(SHOWN_NUDGE_MIN_MS)} to ${signedMs(SHOWN_NUDGE_MAX_MS)} range, so it is set to ${nudgeText(kept)}. ${next}`,
        );
      }
    }
    test.stop();
    setMode(null);
  };

  const toggle = (which: Mode) => (mode === which ? end() : begin(which));

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
        <PinnedHeader scrolled={pinned.scrolled}>
          <ScreenHeader title="Latency nudge" subtitle="This device only" onBack={() => backOr("/")} backTestID="latency-back" />
        </PinnedHeader>
        <ScrollView contentContainerStyle={styles.content} {...pinned.scrollProps}>
          <ThemedText themeColor="textSecondary" style={styles.intro}>
            Minus plays this device earlier to make up for the delay of its speaker or headphones. Plus plays it later
          </ThemedText>

          <View style={[styles.panel, { backgroundColor: theme.backgroundElement }]}>
            <View style={styles.readout}>
              <ThemedText style={[styles.readoutValue, { color: theme.text }]}>{shown > 0 ? `+${shown}` : shown < 0 ? `\u2212${-shown}` : "0"}</ThemedText>
              <ThemedText themeColor="textSecondary" style={styles.readoutUnit}>
                ms
              </ThemedText>
            </View>
            <ThemedText type="caption" themeColor="textSecondary" style={styles.centered}>
              {shown === 0 ? "No nudge" : shown < 0 ? "Sounds play this much earlier" : "Sounds play this much later"}
            </ThemedText>
            <VolumeBar
              label="Nudge"
              testID="latency-bar"
              accessibleName="Latency nudge"
              accessibleRange={{ min: SHOWN_NUDGE_MIN_MS, max: SHOWN_NUDGE_MAX_MS, now: shown }}
              value={(shown - SHOWN_NUDGE_MIN_MS) / (SHOWN_NUDGE_MAX_MS - SHOWN_NUDGE_MIN_MS)}
              valueText={nudgeText(nudge)}
              hideValue
              bare
              origin={-SHOWN_NUDGE_MIN_MS / (SHOWN_NUDGE_MAX_MS - SHOWN_NUDGE_MIN_MS)}
              onChange={(fraction) => setNudge(nudgeFromShown(SHOWN_NUDGE_MIN_MS + fraction * (SHOWN_NUDGE_MAX_MS - SHOWN_NUDGE_MIN_MS)))}
            />
            <View style={styles.steps}>
              {[-10, -1, 1, 10].map((step) => (
                <View key={step} style={styles.stepCell}>
                  <ActionButton full medium compact label={step > 0 ? `+${step}` : `\u2212${-step}`} testID={`nudge-${step}`} onPress={() => setNudge(nudgeFromShown(shown + step))} />
                </View>
              ))}
            </View>
            <ActionButton icon="repeat" label="Reset to 0 ms" testID="nudge-reset" disabled={nudge === 0} onPress={() => setNudge(0)} />
          </View>

          <View style={styles.group}>
            <ThemedText type="label" themeColor="textSecondary" role="heading" style={styles.groupLabel}>
              Check by ear
            </ThemedText>
            <View style={[styles.panel, { backgroundColor: theme.backgroundElement }]}>
              <TimingStrip
                testID="nudge-strip"
                rangeMs={STRIP_RANGE_MS}
                phase={test.phase}
                lanes={[
                  { label: "Phone plays", marks: [-testedNudge], tone: "accent" },
                  { label: "You hear", marks: [0], tone: "text" },
                ]}
                summary={`The phone plays each click ${earlyLateText(-testedNudge, "early", "late", "on the beat")}, so you hear it on the beat`}
              />
              <ThemedText type="caption" themeColor="textSecondary" style={styles.centered}>
                {testedNudge === 0 ? "Sent on the beat" : `Sent ${earlyLateText(-testedNudge, "early", "late", "on the beat")} so it reaches you on the beat`}
              </ThemedText>
              <ActionButton
                icon={mode === "check" ? "stop" : "play"}
                label={mode === "check" ? "Stop" : "Play test"}
                testID="nudge-test"
                disabled={measuring}
                onPress={() => toggle("check")}
              />
              <ThemedText type="caption" themeColor="textSecondary" style={styles.centered}>
                {mode === "check" ? "Change the nudge while it plays. Each click should land as the line crosses You hear" : "Each click should land as the line crosses You hear"}
              </ThemedText>
            </View>
          </View>

          {reported === null ? null : reported > LATENCY_MAX_MS ? (
            <ThemedText type="small" themeColor="textSecondary" testID="reported-beyond-range">
              {`This device reports a delay of ${reported} ms for the output it is playing through now, more than the ${LATENCY_MAX_MS} ms a Latency nudge can make up.`}
            </ThemedText>
          ) : (
            <View style={styles.group}>
              <ThemedText type="label" themeColor="textSecondary" role="heading" style={styles.groupLabel}>
                Recommended
              </ThemedText>
              <Pressable
                testID="preset-recommended"
                role="button"
                aria-pressed={nudge === recommended}
                onPress={() => setNudge(recommended)}
                style={[
                  styles.preset,
                  nudge === recommended
                    ? { backgroundColor: theme.accentTint, borderColor: theme.accent }
                    : { backgroundColor: theme.backgroundElement, borderColor: "transparent" },
                ]}
              >
                <ThemedText type="smallBold" themeColor={nudge === recommended ? "accent" : "text"}>
                  {`Use ${nudgeText(recommended)}`}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  The delay this device reports for the output it is playing through now. It changes when you connect headphones or a speaker.
                </ThemedText>
              </Pressable>
            </View>
          )}

          <View style={styles.group}>
            <ThemedText type="label" themeColor="textSecondary" role="heading" style={styles.groupLabel}>
              Tap to measure
            </ThemedText>
            <View style={[styles.panel, { backgroundColor: theme.backgroundElement }]}>
              <ThemedText type="small">Removes how early or late you tend to tap. The clicks play with no nudge while you tap the pad on every click in both steps.</ThemedText>
              <TimingStrip
                testID="tap-strip"
                rangeMs={STRIP_RANGE_MS}
                phase={test.phase}
                lanes={[
                  { label: "You hear", marks: [0], tone: "text" },
                  { label: "Step 1", marks: builtIn ? builtIn.offsetsMs : offsets, tone: builtIn ? "muted" : "accent", dots: true },
                  { label: "Step 2", marks: mode === "output" ? offsets : outputTaps, tone: "accent", dots: true },
                ]}
                summary={estimate === null ? "No nudge measured yet" : `Your taps suggest a nudge of ${nudgeText(estimate)}`}
              />
              <View style={styles.step}>
                <ThemedText type="smallBold">Step 1: built-in speaker</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  Disconnect Bluetooth and headphones so this phone plays through its own speaker.
                </ThemedText>
                {notBuiltIn ? (
                  <ThemedText type="small" themeColor="danger" testID="step-1-warning">
                    {`This device reports a ${reported} ms delay right now, so it may still be playing through Bluetooth.`}
                  </ThemedText>
                ) : null}
                <ActionButton
                  icon={mode === "builtIn" ? "stop" : "touch"}
                  label={mode === "builtIn" ? "Stop step 1" : builtIn ? "Redo step 1" : "Start step 1"}
                  accent={builtIn === null && mode !== "builtIn"}
                  testID="measure-step-1"
                  disabled={mode === "check" || mode === "output"}
                  onPress={() => toggle("builtIn")}
                />
              </View>
              <View style={styles.step}>
                <ThemedText type="smallBold" themeColor={builtIn ? "text" : "textTertiary"}>
                  Step 2: Bluetooth
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  Connect the headphones or speaker you will play through, then tap along again.
                </ThemedText>
                {sameOutput ? (
                  <ThemedText type="small" themeColor="danger" testID="step-2-warning">
                    This looks like the same output as step 1. Connect Bluetooth before you tap.
                  </ThemedText>
                ) : null}
                <ActionButton
                  icon={mode === "output" ? "stop" : "touch"}
                  label={mode === "output" ? "Stop and set" : "Start step 2"}
                  accent={builtIn !== null && mode !== "output"}
                  testID="measure-step-2"
                  disabled={builtIn === null || mode === "check" || mode === "builtIn"}
                  onPress={() => toggle("output")}
                />
              </View>
              {message ? (
                <ThemedText testID="latency-message" type="smallBold" role="status" aria-live="polite">
                  {message}
                </ThemedText>
              ) : null}
              <Pressable
                role="button"
                testID="tap-pad"
                onPress={ignorePress}
                onPressIn={() => {
                  if (!measuring) return;
                  const offset = test.tapOffset(performance.now());
                  if (offset !== null) setOffsets((shown) => [...shown, offset]);
                }}
                style={[
                  styles.pad,
                  measuring ? { backgroundColor: theme.accent, borderColor: theme.accent } : { backgroundColor: theme.accentTint, borderColor: "transparent" },
                ]}
              >
                <Icon name="touch" size={32} color={measuring ? "onAccent" : "accent"} />
                <ThemedText type="heading" themeColor={measuring ? "onAccent" : "text"}>
                  {measuring ? `Tap on every click (${offsets.length})` : "Tap pad"}
                </ThemedText>
                {measuring ? (
                  <ThemedText type="caption" themeColor="onAccent" testID="tap-estimate">
                    {offsets.length < MIN_TAPS
                      ? `Keep tapping, ${MIN_TAPS - offsets.length} more to measure`
                      : mode === "builtIn"
                        ? lean === null
                          ? "Keep tapping, steadier"
                          : `Your taps land ${earlyLateText(lean, "early", "late", "on the beat")}`
                        : estimate === null
                          ? "Keep tapping, steadier"
                          : `Nudge so far: ${nudgeText(clampLatency(estimate))}`}
                  </ThemedText>
                ) : null}
              </Pressable>
            </View>
          </View>
          {nudgeUnsaved ? (
            <ThemedText testID="setting-unsaved" type="small" themeColor="textSecondary">
              This device could not save your Latency nudge, so it will reset when you reopen the app.
            </ThemedText>
          ) : null}
        </ScrollView>
        <View style={[styles.dock, { backgroundColor: theme.background, borderTopColor: theme.border, paddingBottom: dockInset }]}>
          <ActionButton large full accent icon="check" label="Save" testID="latency-done" disabled={!changed} onPress={() => void saveAndLeave()} />
        </View>
        <ConfirmDialog
          visible={askLeave && !leaving}
          title="Save changes?"
          message={`Your Latency nudge of ${nudgeText(nudge)} is not saved.`}
          confirmLabel="Save"
          cancelLabel="Discard"
          onConfirm={() => void saveAndLeave()}
          onCancel={discardAndLeave}
          onDismiss={() => {
            saveAttempt.current += 1;
            setAskLeave(false);
          }}
          testID="latency-leave-dialog"
        />
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    gap: Spacing.four,
    paddingHorizontal: Spacing.four,
    paddingTop: PINNED_CONTENT_TOP,
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
  centered: { textAlign: "center" },
  steps: { flexDirection: "row", gap: Spacing.two },
  stepCell: { flex: 1, flexDirection: "row" },
  preset: { gap: Spacing.one, padding: Spacing.three, borderRadius: Radius.md, borderWidth: 2, minHeight: 64 },
  intro: { fontSize: 15, lineHeight: 22, fontWeight: 400 },
  buttons: { flexDirection: "row", gap: Spacing.two },
  step: { gap: Spacing.two },
  pad: { height: 200, borderRadius: Radius.lg, borderWidth: 2, alignItems: "center", justifyContent: "center", gap: Spacing.two },
  dock: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: Spacing.four, paddingVertical: Spacing.three },
});
