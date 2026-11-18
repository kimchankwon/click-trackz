import { usePreventRemove } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useTimingTest } from "@/audio/use-timing-test";
import { clipKeyForSpokenCount } from "@/audio/voice-clips";
import { ActionButton } from "@/components/action-button";
import { VolumeBar } from "@/components/playback/volume-bar";
import { TimingStrip } from "@/components/sound/timing-strip";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { PinnedHeader, PINNED_CONTENT_TOP, usePinnedHeader } from "@/components/ui/pinned-header";
import { ScreenHeader } from "@/components/ui/screen-header";
import { useDockInset } from "@/components/ui/use-dock-inset";
import { Fonts, MaxContentWidth, Radius, Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { backOr } from "@/lib/back-or";
import { errorText } from "@/lib/error-text";
import { earlyLateText } from "@/lib/timing-strip";
import { isSide, type Side } from "@/settings/output";
import { useDeviceSetting } from "@/settings/use-device-setting";
import { useLatencyNudge } from "@/settings/use-latency-nudge";
import { useSoundSettings } from "@/settings/use-sound-settings";
import { isVoiceOffsetSetting, stepVoiceOffset, VOICE_OFFSET_MAX_MS, VOICE_OFFSET_MIN_MS, VOICE_OFFSET_STEP_MS, voiceOffsetText } from "@/settings/voice-offset";

const TEST_INTERVAL_MS = 1_000;

export default function VoiceOffsetScreen() {
  const theme = useTheme();
  const pinned = usePinnedHeader();
  const dockInset = useDockInset(Spacing.three);
  const [stored, setStored, offsetUnsaved] = useDeviceSetting("voiceOffsetMs", "0", isVoiceOffsetSetting);
  const { nudgeMs: latencyNudgeMs } = useLatencyNudge();
  const [clickSide] = useDeviceSetting<Side>("clickSide", "both", isSide);
  const [voiceSide] = useDeviceSetting<Side>("voiceSide", "both", isSide);
  const { sound } = useSoundSettings();
  const saved = Number(stored);
  const [draft, setDraft] = useState<number | null>(null);
  const offset = draft ?? saved;
  const changed = draft !== null && draft !== saved;
  const [askLeave, setAskLeave] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const test = useTimingTest();
  const tested = test.tested?.voiceOffsetMs ?? offset;
  usePreventRemove(changed && !leaving, () => setAskLeave(true));
  useEffect(() => {
    if (leaving) backOr("/");
  }, [leaving]);

  const saveAttempt = useRef(0);
  const setOffsetDraft = (ms: number) => {
    saveAttempt.current += 1;
    setDraft(ms);
    test.retune({ latencyNudgeMs: latencyNudgeMs, voiceOffsetMs: ms });
  };
  const move = (steps: number) => setOffsetDraft(stepVoiceOffset(offset, steps));
  const saveAndLeave = async () => {
    const mine = ++saveAttempt.current;
    test.stop();
    const kept = await setStored(String(offset));
    if (saveAttempt.current !== mine) return;
    if (kept) setLeaving(true);
    else setAskLeave(false);
  };
  const discardAndLeave = () => {
    test.stop();
    setLeaving(true);
  };
  const toggleTest = () => {
    setProblem(null);
    if (test.running) {
      test.stop();
      return;
    }
    test
      .start({
        intervalMs: TEST_INTERVAL_MS,
        latencyNudgeMs: latencyNudgeMs,
        voiceOffsetMs: offset,
        volumes: { click: sound.clickVolume, voice: sound.voiceVolume },
        sides: { click: clickSide, voice: voiceSide },
        voice: { speaker: sound.speaker, voiceSpeed: sound.voiceSpeed, keyFor: (index: number) => clipKeyForSpokenCount((index % 4) + 1) },
      })
      .catch((error: unknown) => setProblem(errorText(error)));
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
        <PinnedHeader scrolled={pinned.scrolled}>
          <ScreenHeader title="Voice cue offset" subtitle="This device only" onBack={() => backOr("/")} backTestID="voice-offset-back" />
        </PinnedHeader>
        <ScrollView contentContainerStyle={styles.content} {...pinned.scrollProps}>
          <ThemedText themeColor="textSecondary" style={styles.intro}>
            Moves Voice cues sooner or later than the Click
          </ThemedText>

          <View style={[styles.panel, { backgroundColor: theme.backgroundElement }]}>
            <View style={styles.readout}>
              <ThemedText style={[styles.readoutValue, { color: theme.text }]} testID="voice-offset-value">
                {Math.abs(offset)}
              </ThemedText>
              <ThemedText themeColor="textSecondary" style={styles.readoutUnit}>
                ms
              </ThemedText>
            </View>
            <ThemedText type="caption" themeColor="textSecondary" style={styles.centered}>
              {offset === 0 ? "Voice cues play with the Click" : offset > 0 ? "Voice cues play this much later" : "Voice cues play this much sooner"}
            </ThemedText>
            <VolumeBar
              label="Voice cue offset"
              testID="voice-offset-bar"
              accessibleName="Voice cue offset"
              accessibleRange={{ min: VOICE_OFFSET_MIN_MS, max: VOICE_OFFSET_MAX_MS, now: offset }}
              value={(offset - VOICE_OFFSET_MIN_MS) / (VOICE_OFFSET_MAX_MS - VOICE_OFFSET_MIN_MS)}
              valueText={voiceOffsetText(offset)}
              hideValue
              bare
              origin={-VOICE_OFFSET_MIN_MS / (VOICE_OFFSET_MAX_MS - VOICE_OFFSET_MIN_MS)}
              onChange={(fraction) => setOffsetDraft(stepVoiceOffset(VOICE_OFFSET_MIN_MS + fraction * (VOICE_OFFSET_MAX_MS - VOICE_OFFSET_MIN_MS), 0))}
            />
            <View style={styles.steps}>
              {[-5, -1, 1, 5].map((steps) => (
                <View key={steps} style={styles.stepCell}>
                  <ActionButton
                    full
                    medium
                    compact
                    label={`${steps > 0 ? "+" : "−"}${Math.abs(steps) * VOICE_OFFSET_STEP_MS}`}
                    testID={`voice-offset-${steps > 0 ? "later" : "sooner"}-${Math.abs(steps)}`}
                    disabled={steps > 0 ? offset >= VOICE_OFFSET_MAX_MS : offset <= VOICE_OFFSET_MIN_MS}
                    onPress={() => move(steps)}
                  />
                </View>
              ))}
            </View>
            <ActionButton icon="repeat" label="Reset to 0 ms" testID="voice-offset-reset" disabled={offset === 0} onPress={() => setOffsetDraft(0)} />
          </View>

          <View style={styles.group}>
            <ThemedText type="label" themeColor="textSecondary" role="heading" style={styles.groupLabel}>
              Check by ear
            </ThemedText>
            <View style={[styles.panel, { backgroundColor: theme.backgroundElement }]}>
              <TimingStrip
                testID="voice-offset-strip"
                rangeMs={TEST_INTERVAL_MS / 2}
                phase={test.phase}
                lanes={[
                  { label: "Click", marks: [0], tone: "text" },
                  { label: "Voice", marks: [tested], tone: "accent" },
                ]}
                summary={`The Voice plays ${earlyLateText(tested, "before", "after", "with")} the Click`}
              />
              <ThemedText type="caption" themeColor={problem ? "danger" : "textSecondary"} style={styles.centered}>
                {problem ?? voiceOffsetText(tested)}
              </ThemedText>
              <ActionButton icon={test.running ? "stop" : "play"} label={test.running ? "Stop" : "Play test"} testID="voice-offset-test" onPress={toggleTest} />
              <ThemedText type="caption" themeColor="textSecondary" style={styles.centered}>
                {test.running ? "Change the offset while it plays. Each count should land with its Click" : "Each count should land with its Click"}
              </ThemedText>
            </View>
          </View>
          {offsetUnsaved ? (
            <ThemedText testID="setting-unsaved" type="small" themeColor="textSecondary">
              This device could not save your Voice cue offset, so it will reset when you reopen the app.
            </ThemedText>
          ) : null}
        </ScrollView>
        <View style={[styles.dock, { backgroundColor: theme.background, borderTopColor: theme.border, paddingBottom: dockInset }]}>
          <ActionButton large full accent icon="check" label="Save" testID="voice-offset-save" disabled={!changed} onPress={() => void saveAndLeave()} />
        </View>
        <ConfirmDialog
          visible={askLeave && !leaving}
          title="Save changes?"
          message={`Your Voice cue offset (${voiceOffsetText(offset)}) is not saved.`}
          confirmLabel="Save"
          cancelLabel="Discard"
          onConfirm={() => void saveAndLeave()}
          onCancel={discardAndLeave}
          onDismiss={() => {
            saveAttempt.current += 1;
            setAskLeave(false);
          }}
          testID="voice-offset-leave-dialog"
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
  intro: { fontSize: 15, lineHeight: 22, fontWeight: 400 },
  group: { gap: Spacing.two },
  groupLabel: { paddingHorizontal: Spacing.one },
  panel: { gap: Spacing.three, padding: Spacing.three, borderRadius: Radius.lg },
  readout: { flexDirection: "row", alignItems: "baseline", justifyContent: "center", gap: Spacing.two },
  readoutValue: { fontFamily: Fonts.condensed, fontSize: 72, lineHeight: 78, fontWeight: "700", fontVariant: ["tabular-nums"] },
  readoutUnit: { fontFamily: Fonts.display, fontSize: 24, lineHeight: 30, fontWeight: "700" },
  centered: { textAlign: "center" },
  steps: { flexDirection: "row", gap: Spacing.two },
  stepCell: { flex: 1, flexDirection: "row" },
  dock: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: Spacing.four, paddingVertical: Spacing.three },
});
