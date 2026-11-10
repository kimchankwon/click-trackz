# Sync the schedule, not the beats

Members must hear every Count at the same instant, so no device ever receives beats over the network. Start, Jump and Stop are Convex mutations that record a future instant on the server's clock; each device already holds the Song and an estimate of its offset from the server clock, and computes every beat locally from those. Disagreement between devices is bounded by clock-offset error (typically 5 to 20 ms on decent wifi) instead of by network jitter.

## Considered Options

- **Push each beat from the server.** Rejected: network jitter lands directly on the beat.
- **Trust each device's own clock.** Rejected: phone clocks routinely differ by hundreds of milliseconds.
- **Ableton Link or another peer-to-peer clock.** Rejected for v1: no browser support, and Convex is already the single authority for Group state.

## Consequences

- Every timestamp that matters comes from the Convex server, never from `Date.now()` on a client.
- Admin commands always target a future instant, never "now". Start and Jump land on a bar line. Stop lands one second after it is pressed (`STOP_LEAD_MS`), without waiting for the bar line; a second gives every device time to hear of it first, and each device drops any sound it had already queued past that instant. A shorter 200 ms lead let slower devices stop late.
- Start's Lead-in is a fixed second on the server clock (`LEAD_IN_MS`). A Lead-in sized from measured round trips (half a second to two) left devices starting out of step; a fixed second is short enough to feel immediate and long enough for every device to hear of the Start first. A device that still hears of it late joins on the next beat, in sync.
- Clients keep measuring their clock offset during Playback and slew towards a new estimate instead of jumping.
