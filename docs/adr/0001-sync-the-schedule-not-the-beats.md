# Sync the schedule, not the beats

Members must hear every Count at the same instant, so no device ever receives beats over the network. Start, Jump and Stop are Convex mutations that record a future instant on the server's clock; each device already holds the Song and an estimate of its offset from the server clock, and computes every beat locally from those. Disagreement between devices is bounded by clock-offset error (typically 5 to 20 ms on decent wifi) instead of by network jitter.

## Considered Options

- **Push each beat from the server.** Rejected: network jitter lands directly on the beat.
- **Trust each device's own clock.** Rejected: phone clocks routinely differ by hundreds of milliseconds.
- **Ableton Link or another peer-to-peer clock.** Rejected for v1: no browser support, and Convex is already the single authority for Group state.

## Consequences

- Every timestamp that matters comes from the Convex server, never from `Date.now()` on a client.
- Admin commands always target a future bar line, never "now".
- Clients keep measuring their clock offset during Playback and slew towards a new estimate instead of jumping.
