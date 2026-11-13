import { Image } from "expo-image";
import { StyleSheet, Text, View } from "react-native";

import { Icon } from "@/components/ui/icon";
import { Fonts } from "@/constants/theme";
import { nowPlayingArtwork } from "@/audio/now-playing-artwork";

import { useDemoBeat } from "./use-demo-beat";


const SONG_S = 252;
const SHOWN_AT_S = 96;
const clockOf = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

const GLASS = "#2B2C30";
const ON_GLASS = "#FFFFFF";
const ON_GLASS_SECONDARY = "#B4B7BE";
const TRACK = "#4A4C52";

export function ControlCenterMock() {
  const beat = useDemoBeat();
  const elapsedS = SHOWN_AT_S + Math.floor(beat.index / 2);
  const progress = elapsedS / SONG_S;
  return (
    <View role="img" aria-label="The iPhone Control Center showing Click Trackz playing Chorus 1, with previous, pause and next buttons" style={styles.card}>
      <View style={styles.top}>
        <Image source={nowPlayingArtwork} style={styles.artwork} contentFit="cover" accessible={false} />
        <View style={styles.titles}>
          <Text numberOfLines={1} style={styles.title}>
            Sunday Opener
          </Text>
          <Text numberOfLines={1} style={styles.subtitle}>
            Chorus 1
          </Text>
        </View>
      </View>
      <View style={styles.progress}>
        <View style={[styles.track, { backgroundColor: TRACK }]}>
          <View style={[styles.fill, { width: `${progress * 100}%` }]} />
        </View>
        <View style={styles.times}>
          <Text style={styles.time}>{clockOf(elapsedS)}</Text>
          <Text style={styles.time}>{`-${clockOf(SONG_S - elapsedS)}`}</Text>
        </View>
      </View>
      <View style={styles.controls}>
        <Icon name="previousSong" size={30} tint={ON_GLASS} />
        <Icon name="pause" size={40} tint={ON_GLASS} />
        <Icon name="nextSong" size={30} tint={ON_GLASS} />
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
});
