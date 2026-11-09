import { useEffect, useState, type RefObject } from "react";
import { Platform } from "react-native";

import type { CueAudioEngine } from "@/audio/engine";
import { ThemedText } from "@/components/themed-text";

const wanted = () => Platform.OS === "web" && typeof window !== "undefined" && new URLSearchParams(window.location.search).has("audiodebug");

export function AudioDebug({ engine, soundOn }: { engine: RefObject<CueAudioEngine | null>; soundOn: boolean }) {
  const [enabled] = useState(wanted);
  const [text, setText] = useState("");
  useEffect(() => {
    if (!enabled) return;
    const timer = setInterval(() => {
      const snapshot = engine.current?.debugSnapshot();
      setText(
        [
          `page ${document.visibilityState}`,
          `sound ${soundOn ? "on" : "off"}`,
          `audio ${snapshot?.state ?? "none"}`,
          `time ${snapshot?.currentTime?.toFixed(2) ?? "-"}`,
          `ahead ${snapshot?.aheadMs ?? "-"} ms`,
          `latency ${snapshot?.latencyMs?.toFixed(1) ?? "-"} ms`,
          `pan click ${snapshot?.pan.click ?? "-"} voice ${snapshot?.pan.voice ?? "-"}`,
          snapshot?.needsFreshContext ? "fresh context next tap" : null,
          snapshot?.failure ?? null,
        ]
          .filter((part) => part !== null)
          .join(", "),
      );
    }, 300);
    return () => clearInterval(timer);
  }, [enabled, engine, soundOn]);
  if (!enabled) return null;
  return (
    <ThemedText type="caption" themeColor="textSecondary" testID="audio-debug" selectable>
      {text}
    </ThemedText>
  );
}
