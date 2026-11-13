import { Image } from "expo-image";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { nowPlayingArtwork } from "@/audio/now-playing-artwork";
import { Icon, type IconName } from "@/components/ui/icon";
import { Fonts } from "@/constants/theme";
import type { LockScreenCommand } from "@/lib/lock-screen";
import { letterAfterNumber, type Section } from "@/sync/timeline";

import { demoActions, useDemoPlayback } from "./use-demo-playback";

const GLASS = "#2B2C30";
const ON_GLASS = "#FFFFFF";
const ON_GLASS_SECONDARY = "#B4B7BE";
const TRACK = "#4A4C52";

const clockOf = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

const titleOf = (section: Section) => `${section.sectionType}${section.number ? ` ${section.number}${letterAfterNumber(section)}` : ""}`;

function Control({ icon, label, command, size }: { icon: IconName; label: string; command: LockScreenCommand; size: number }) {
  return (
    <Pressable
      role="button"
      aria-label={label}
      testID={`demo-control-${command}`}
      hitSlop={8}
      onPress={() => demoActions.command(command)}
      style={({ pressed }) => [styles.control, { opacity: pressed ? 0.5 : 1 }]}
    >
      <Icon name={icon} size={size} tint={ON_GLASS} />
    </Pressable>
  );
}

export function ControlCenterMock() {
  const frame = useDemoPlayback();
  const live = frame.status !== "idle";
  const sounding = frame.status === "playing" || frame.status === "stopping";
  const current = frame.sectionIndex === null ? null : frame.song.sections[frame.sectionIndex];
  const progress = live ? Math.min(1, frame.elapsedMs / frame.lengthMs) : 0;
  return (
    <View style={styles.card} testID="demo-control-center">
      <View style={styles.top}>
        <Image source={nowPlayingArtwork} style={styles.artwork} contentFit="cover" accessible={false} />
        <View style={styles.titles}>
          <Text numberOfLines={1} style={styles.title}>
            {frame.song.title}
          </Text>
          <Text numberOfLines={1} style={styles.subtitle}>
            {live && current ? titleOf(current) : "Ready to start"}
          </Text>
        </View>
      </View>
      <View style={styles.progress}>
        <View style={[styles.track, { backgroundColor: TRACK }]}>
          <View style={[styles.fill, { width: `${progress * 100}%` }]} />
        </View>
        <View style={styles.times}>
          <Text style={styles.time}>{clockOf(live ? frame.elapsedMs : 0)}</Text>
          <Text style={styles.time}>{`-${clockOf(frame.lengthMs - (live ? frame.elapsedMs : 0))}`}</Text>
        </View>
      </View>
      <View style={styles.controls}>
        <Control icon="previousSong" label={live ? "Previous Section" : "Previous Song"} command="previousTrack" size={30} />
        <Control icon={sounding ? "pause" : "play"} label={sounding ? "Pause" : "Play"} command={sounding ? "pause" : "play"} size={40} />
        <Control icon="nextSong" label={live ? "Next Section" : "Next Song"} command="nextTrack" size={30} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { width: "100%", maxWidth: 340, alignSelf: "center", backgroundColor: GLASS, borderRadius: 32, padding: 22, gap: 20 },
  top: { flexDirection: "row", alignItems: "center", gap: 14 },
  artwork: { width: 56, height: 56, borderRadius: 12 },
  titles: { flex: 1, minWidth: 0, gap: 2 },
  title: { fontFamily: Fonts.body, fontSize: 17, fontWeight: "700", color: ON_GLASS },
  subtitle: { fontFamily: Fonts.body, fontSize: 15, fontWeight: "500", color: ON_GLASS_SECONDARY },
  progress: { gap: 6 },
  track: { height: 6, borderRadius: 3, overflow: "hidden" },
  fill: { height: 6, borderRadius: 3, backgroundColor: ON_GLASS },
  times: { flexDirection: "row", justifyContent: "space-between" },
  time: { fontFamily: Fonts.body, fontSize: 12, fontWeight: "600", color: ON_GLASS_SECONDARY, fontVariant: ["tabular-nums"] },
  controls: { flexDirection: "row", alignItems: "center", justifyContent: "space-evenly" },
  control: { minWidth: 48, minHeight: 48, alignItems: "center", justifyContent: "center" },
});
