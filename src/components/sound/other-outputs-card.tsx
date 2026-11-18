import { useMemo, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useSharedValue } from "react-native-reanimated";

import { ActionButton } from "@/components/action-button";
import { Card, Divider } from "@/components/group/card";
import { SpeakerStrip, type SpeakerLane } from "@/components/group/speaker-strip";
import { ThemedText } from "@/components/themed-text";
import { Spacing } from "@/constants/theme";
import { clampLatency, nudgeFromShown, nudgeShown, nudgeText } from "@/settings/latency";
import { saveLatencyNudgeForOutput, useAudioOutput, useOutputNudges, useRememberedOutputs } from "@/settings/use-latency-nudge";

const STEPS = [-10, -1, 1, 10] as const;
const NOT_PLAYING = -1;

const stepLabel = (step: number) => (step > 0 ? `+${step}` : `−${-step}`);

export function OtherOutputsCard() {
  const current = useAudioOutput();
  const remembered = useRememberedOutputs();
  const currentId = current?.id ?? null;
  const others = useMemo(() => remembered.filter((output) => output.id !== currentId), [remembered, currentId]);
  const nudges = useOutputNudges(others);
  const [targets, setTargets] = useState<Record<string, number>>({});
  const latestTargets = useRef<Record<string, number>>({});
  const [unsaved, setUnsaved] = useState<string | null>(null);
  const phase = useSharedValue(NOT_PLAYING);

  if (others.length === 0) return null;

  const nudgeOf = (outputId: string) => targets[outputId] ?? nudges[outputId]?.nudgeMs ?? 0;

  const draft = (outputId: string, nudgeMs: number) => {
    const value = clampLatency(nudgeMs);
    latestTargets.current = { ...latestTargets.current, [outputId]: value };
    setTargets(latestTargets.current);
  };

  const save = (outputId: string) => {
    const output = others.find((entry) => entry.id === outputId);
    const value = latestTargets.current[outputId];
    if (output === undefined || value === undefined) return;
    setUnsaved(null);
    void saveLatencyNudgeForOutput(value, output).then((saved) => {
      if (!saved) setUnsaved(output.name);
      if (latestTargets.current[outputId] !== value) return;
      const rest = { ...latestTargets.current };
      delete rest[outputId];
      latestTargets.current = rest;
      setTargets(rest);
    });
  };

  const stepNudge = (outputId: string, step: number) => {
    draft(outputId, nudgeFromShown(nudgeShown(nudgeOf(outputId)) + step));
    save(outputId);
  };

  const lanes: SpeakerLane[] = others.map((output) => ({ deviceId: output.id, label: output.name, nudgeMs: nudgeOf(output.id), playing: false }));

  return (
    <Card title="Other audio outputs">
      <ThemedText type="caption" themeColor="textSecondary">
        Speakers and headphones this device has played through. Each keeps its own Latency nudge, used again whenever this device plays through it.
      </ThemedText>
      <SpeakerStrip lanes={lanes} phase={phase} live={false} onNudge={draft} onRelease={save} />
      {others.map((output, index) => (
        <View key={output.id} style={styles.output} testID={`other-output-${output.id}`}>
          {index > 0 ? <Divider /> : null}
          <View style={styles.heading}>
            <View style={styles.grow}>
              <ThemedText type="smallBold" numberOfLines={1}>
                {output.name}
              </ThemedText>
              {nudges[output.id]?.savedForOutput || targets[output.id] !== undefined ? null : (
                <ThemedText type="caption" themeColor="textSecondary" numberOfLines={1}>
                  Uses your earlier nudge
                </ThemedText>
              )}
            </View>
            <ThemedText type="smallBold" testID={`other-output-nudge-${output.id}`}>
              {nudgeText(nudgeOf(output.id))}
            </ThemedText>
          </View>
          <View style={styles.steps}>
            {STEPS.map((step) => (
              <View key={step} style={styles.stepCell}>
                <ActionButton
                  full
                  small
                  compact
                  label={stepLabel(step)}
                  accessibleName={`${stepLabel(step)} ms for ${output.name}`}
                  testID={`other-output-${output.id}-${step}`}
                  onPress={() => stepNudge(output.id, step)}
                />
              </View>
            ))}
          </View>
        </View>
      ))}
      {unsaved ? (
        <ThemedText type="caption" themeColor="danger" testID="other-output-unsaved" role="alert">
          {`This device could not save the nudge for ${unsaved}.`}
        </ThemedText>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  output: { gap: Spacing.two },
  heading: { flexDirection: "row", alignItems: "center", gap: Spacing.three },
  grow: { flex: 1 },
  steps: { flexDirection: "row", gap: Spacing.two },
  stepCell: { flex: 1, flexDirection: "row" },
});
