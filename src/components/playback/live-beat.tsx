import { useEffect, useState, type ReactNode } from "react";

import type { ShownBeat } from "@/sync/shown-beat";
import type { Beat } from "@/sync/timeline";

export function useLiveBeat(shownBeat: ShownBeat) {
  const [beat, setBeat] = useState(shownBeat.get);
  useEffect(() => {
    const follow = () => setBeat(shownBeat.get());
    const unsubscribe = shownBeat.subscribe(follow);
    follow();
    return unsubscribe;
  }, [shownBeat]);
  return beat;
}

export function LiveBeat({ shownBeat, children }: { shownBeat: ShownBeat; children: (beat: Beat | null) => ReactNode }) {
  return children(useLiveBeat(shownBeat));
}
