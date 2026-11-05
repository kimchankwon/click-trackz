import { ConvexClient } from "convex/browser";
import { anyApi } from "convex/server";
import { performance } from "node:perf_hooks";

import { estimateClockOffset, type ClockSample } from "../src/sync/clock.ts";

const url = process.env.EXPO_PUBLIC_CONVEX_URL;
if (!url) throw new Error("EXPO_PUBLIC_CONVEX_URL is not set");

const clients = Number(process.argv[2] ?? 2);
const pings = Number(process.argv[3] ?? 12);

async function measure(label: string) {
  const client = new ConvexClient(url!);
  const samples: ClockSample[] = [];
  for (let i = 0; i < pings; i++) {
    const sentAt = performance.timeOrigin + performance.now();
    const serverAt: number = await client.mutation(anyApi.clock.now, {});
    const receivedAt = performance.timeOrigin + performance.now();
    samples.push({ sentAt, serverAt, receivedAt });
  }
  await client.close();
  const estimate = estimateClockOffset(samples);
  if (!estimate) throw new Error(`${label}: no usable samples`);
  const roundTrips = samples.map((s) => s.receivedAt - s.sentAt).sort((a, b) => a - b);
  console.log(
    `${label}: offset ${estimate.offsetMs.toFixed(1)} ms, uncertainty ±${estimate.uncertaintyMs.toFixed(1)} ms, ` +
      `round trip min ${roundTrips[0].toFixed(1)} / median ${roundTrips[Math.floor(roundTrips.length / 2)].toFixed(1)} ms`,
  );
  return estimate;
}

const estimates = await Promise.all(Array.from({ length: clients }, (_, i) => measure(`client ${i + 1}`)));
const offsets = estimates.map((e) => e.offsetMs);
const spread = Math.max(...offsets) - Math.min(...offsets);
const bound = Math.max(...estimates.map((e) => e.uncertaintyMs)) * 2;
console.log(`spread between clients: ${spread.toFixed(1)} ms (worst-case bound ${bound.toFixed(1)} ms)`);
process.exit(spread <= bound ? 0 : 1);
