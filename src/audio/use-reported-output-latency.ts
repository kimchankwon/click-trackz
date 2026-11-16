import { useEffect, useState } from "react";

import { reportedOutputLatencyMs } from "./output-latency";

const REFRESH_MS = 1_000;

const rounded = () => {
  const ms = reportedOutputLatencyMs();
  return ms === null ? null : Math.round(ms);
};

export function useReportedOutputLatency() {
  const [reported, setReported] = useState(rounded);
  useEffect(() => {
    const timer = setInterval(() => setReported(rounded()), REFRESH_MS);
    return () => clearInterval(timer);
  }, []);
  return reported;
}
