import { StyleSheet, View } from "react-native";

import type { ThemeColor } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { pingQuality, type PingQuality } from "@/sync/ping-quality";

const look: Record<PingQuality, { bars: number; color: ThemeColor; label: string }> = {
  good: { bars: 3, color: "success", label: "good" },
  weak: { bars: 2, color: "warning", label: "weak" },
  bad: { bars: 1, color: "danger", label: "poor" },
};

export function SignalBars({ roundTripMs, size = 12, testID }: { roundTripMs: number | null; size?: number; testID?: string }) {
  const theme = useTheme();
  const quality = roundTripMs === null ? null : look[pingQuality(roundTripMs)];
  const barWidth = Math.max(2, Math.round(size / 4));
  return (
    <View
      testID={testID}
      aria-label={roundTripMs === null ? "Connection not measured yet" : `Connection ${quality?.label}, ${Math.round(roundTripMs)} ms`}
      style={[styles.bars, { height: size, gap: Math.max(1, Math.round(barWidth / 2)) }]}
    >
      {[1, 2, 3].map((bar) => (
        <View
          key={bar}
          style={{
            width: barWidth,
            height: Math.round((size * (bar + 1)) / 4),
            borderRadius: barWidth / 2,
            backgroundColor: quality && bar <= quality.bars ? theme[quality.color] : theme.dotInactive,
          }}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  bars: { flexDirection: "row", alignItems: "flex-end" },
});
