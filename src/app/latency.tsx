import { usePreventRemove } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

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
import { MIN_TAPS, nudgeFromTaps } from "@/lib/timing-test";
import { clampLatency, isLatencySetting, LATENCY_MAX_MS, LATENCY_MIN_MS, latencyPresets } from "@/settings/latency";
import { useDeviceSetting } from "@/settings/use-device-setting";

const TEST_INTERVAL_MS = 1_000;
const STRIP_RANGE_MS = TEST_INTERVAL_MS / 2;
const TEST_VOLUMES = { click: 0.8, voice: 0 };

type Mode = "check" | "measure";

const ignorePress = () => undefined;

export default function LatencyScreen() {
  const theme = useTheme();
  const pinned = usePinnedHeader();
  const dockInset = useDockInset(Spacing.three);
  const [stored, setStored, nudgeUnsaved] = useDeviceSetting("latencyNudgeMs", "0", isLatencySetting);
  const saved = Number(stored);
  const [draft, setDraft] = useState<number | null>(null);
  const nudge = draft ?? saved;
  const changed = draft !== null && draft !== saved;
  const [askLeave, setAskLeave] = useState(false);
  const [leaving, setLeaving] = useState(false);
  usePreventRemove(changed && !leaving, () => setAskLeave(true));
  useEffect(() => {
    if (leaving) backOr("/");
  }, [leaving]);
  const [mode, setMode] = useState<Mode | null>(null);
  const [offsets, setOffsets] = useState<number[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [chosenPreset, setChosenPreset] = useState<string | null>(null);
  const test = useTimingTest();
  const testedNudge = test.tested?.latencyNudgeMs ?? nudge;
  const estimate = mode === "measure" ? nudgeFromTaps(testedNudge, offsets) : null;

  const saveAttempt = useRef(0);
  const setNudge = (ms: number) => {
    saveAttempt.current += 1;
    setDraft(clampLatency(ms));
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
    setMode(next);
    test.start({ intervalMs: TEST_INTERVAL_MS, latencyNudgeMs: nudge, voiceOffsetMs: 0, volumes: TEST_VOLUMES }).catch((error: unknown) => {
      setMode(null);
      setMessage(errorText(error));
    });
  };

  const end = () => {
    if (mode === "measure") {
      const measured = nudgeFromTaps(testedNudge, offsets);
      if (measured === null) setMessage(`Tap along with at least ${MIN_TAPS} clicks, then press Stop.`);
      else {
        const kept = clampLatency(measured);
        setNudge(kept);
        const next = kept === saved ? "That is your saved nudge already." : "Press Save to keep it.";
        setMessage(
          kept === measured
            ? `Measured ${measured} ms from ${offsets.length} taps. ${next}`
            : `Measured ${measured} ms, beyond the ${LATENCY_MIN_MS} to ${LATENCY_MAX_MS} ms range, so it is set to ${kept} ms. ${next}`,
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
            Lines up late Bluetooth audio with everyone else
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
              origin={-LATENCY_MIN_MS / (LATENCY_MAX_MS - LATENCY_MIN_MS)}
              onChange={(fraction) => setNudge(LATENCY_MIN_MS + fraction * (LATENCY_MAX_MS - LATENCY_MIN_MS))}
            />
            <View style={styles.steps}>
              {[-10, -1, 1, 10].map((step) => (
                <View key={step} style={styles.stepCell}>
                  <ActionButton full medium compact label={step > 0 ? `+${step}` : `\u2212${-step}`} testID={`nudge-${step}`} onPress={() => setNudge(nudge + step)} />
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
                disabled={mode === "measure"}
                onPress={() => toggle("check")}
              />
              <ThemedText type="caption" themeColor="textSecondary" style={styles.centered}>
                Each click should land as the line crosses You hear
              </ThemedText>
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
              <ThemedText type="small">Play through the headphones or speakers you will use, tap the pad on every click, then press Stop.</ThemedText>
              <TimingStrip
                testID="tap-strip"
                rangeMs={STRIP_RANGE_MS}
                phase={test.phase}
                lanes={[
                  { label: "You hear", marks: [0], tone: "text" },
                  { label: "Your taps", marks: offsets, tone: "accent", dots: true },
                ]}
                summary={estimate === null ? "No taps measured yet" : `Your taps suggest a nudge of ${estimate} ms`}
              />
              <ActionButton
                icon={mode === "measure" ? "stop" : "touch"}
                label={mode === "measure" ? "Stop and set" : "Start tapping"}
                accent={mode !== "measure"}
                testID="measure-toggle"
                disabled={mode === "check"}
                onPress={() => toggle("measure")}
              />
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
                  if (mode !== "measure") return;
                  const offset = test.tapOffset(performance.now());
                  if (offset !== null) setOffsets((shown) => [...shown, offset]);
                }}
                style={[
                  styles.pad,
                  mode === "measure" ? { backgroundColor: theme.accent, borderColor: theme.accent } : { backgroundColor: theme.accentTint, borderColor: "transparent" },
                ]}
              >
                <Icon name="touch" size={32} color={mode === "measure" ? "onAccent" : "accent"} />
                <ThemedText type="heading" themeColor={mode === "measure" ? "onAccent" : "text"}>
                  {mode === "measure" ? `Tap on every click (${offsets.length})` : "Tap pad"}
                </ThemedText>
                {mode === "measure" ? (
                  <ThemedText type="caption" themeColor="onAccent" testID="tap-estimate">
                    {estimate === null ? `Keep tapping, ${Math.max(0, MIN_TAPS - offsets.length)} more to measure` : `Nudge so far: ${clampLatency(estimate)} ms`}
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
          message={`Your Latency nudge of ${nudge} ms is not saved.`}
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
  presetTop: { flexDirection: "row", alignItems: "center", gap: Spacing.two },
  centered: { textAlign: "center" },
  steps: { flexDirection: "row", gap: Spacing.two },
  stepCell: { flex: 1, flexDirection: "row" },
  presets: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.two },
  preset: { width: "48.5%", flexGrow: 1, gap: 2, padding: Spacing.three, borderRadius: Radius.md, borderWidth: 2, minHeight: 64 },
  tabular: { fontVariant: ["tabular-nums"] },
  grow: { flex: 1, minWidth: 0 },
  intro: { fontSize: 15, lineHeight: 22, fontWeight: 400 },
  buttons: { flexDirection: "row", gap: Spacing.two },
  pad: { height: 200, borderRadius: Radius.lg, borderWidth: 2, alignItems: "center", justifyContent: "center", gap: Spacing.two },
  dock: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: Spacing.four, paddingVertical: Spacing.three },
});
