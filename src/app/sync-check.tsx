import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth } from "convex/react";
import { useEffect, useMemo, useState } from "react";
import { StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { demoSong } from "@/sync/demo-song";
import { beatsBetween, type Beat } from "@/sync/timeline";
import { useServerClock } from "@/sync/use-server-clock";

const voiceText = (beat: Beat) =>
  beat.voiceCue
    ? `${beat.voiceCue.sectionType}${beat.voiceCue.number ?? ""}`
    : beat.spokenCount !== null
      ? String(beat.spokenCount)
      : "";

export default function SyncCheckScreen() {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const { signIn } = useAuthActions();
  useEffect(() => {
    if (!isLoading && !isAuthenticated) void signIn("anonymous").catch(() => undefined);
  }, [isLoading, isAuthenticated, signIn]);
  const { estimate, serverNow } = useServerClock();
  const theme = useTheme();
  const songMs = useMemo(() => {
    const beats = beatsBetween(demoSong, { startsAt: 0, startSection: 0 }, 0, Infinity);
    const last = beats.at(-1)!;
    return last.at + 60_000 / demoSong.sections.at(-1)!.bpm;
  }, []);
  const [frame, setFrame] = useState<{ beat: Beat | null; deviceOffset: number | null }>({
    beat: null,
    deviceOffset: null,
  });

  useEffect(() => {
    let handle = 0;
    const tick = () => {
      const now = serverNow();
      if (now !== null) {
        const startsAt = Math.floor(now / songMs) * songMs;
        const beats = beatsBetween(demoSong, { startsAt, startSection: 0 }, startsAt, now + 1);
        setFrame({ beat: beats.at(-1) ?? null, deviceOffset: now - Date.now() });
      }
      handle = requestAnimationFrame(tick);
    };
    handle = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(handle);
  }, [serverNow, songMs]);

  const { beat, deviceOffset } = frame;
  return (
    <ThemedView
      style={[styles.container, beat?.accent ? { backgroundColor: theme.backgroundSelected } : null]}
    >
      <SafeAreaView style={styles.safeArea}>
        <ThemedText type="title" testID="sync-count" style={styles.count}>
          {beat?.count ?? "…"}
        </ThemedText>
        <ThemedText type="subtitle" testID="sync-voice">
          {beat ? voiceText(beat) : ""}
        </ThemedText>
        <ThemedText testID="sync-offset" themeColor="textSecondary">
          {estimate && deviceOffset !== null
            ? `server minus device clock ${deviceOffset.toFixed(1)} ms, ±${estimate.uncertaintyMs.toFixed(1)} ms`
            : "Measuring clock…"}
        </ThemedText>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.four,
    paddingHorizontal: Spacing.four,
  },
  count: { fontSize: 96, lineHeight: 104 },
});
