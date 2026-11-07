import { useEffect, useRef, useState } from "react";

export function useServerNow(serverNow: number | undefined, everyMs: number) {
  const offsetMs = useRef(0);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (serverNow !== undefined) offsetMs.current = serverNow - Date.now();
    const timer = setTimeout(() => setNow(Date.now() + offsetMs.current), 0);
    return () => clearTimeout(timer);
  }, [serverNow]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now() + offsetMs.current), everyMs);
    return () => clearInterval(timer);
  }, [everyMs]);

  return now;
}
