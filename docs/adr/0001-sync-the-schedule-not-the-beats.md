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
- Clients keep measuring their clock offset during Playback, every 10 seconds while the app is on screen, and slew towards a new estimate instead of jumping. Holding one estimate through a Song was tried and dropped: device clocks drift tens of parts per million against the server, which is 6 to 15 ms over five minutes.
- Only pings from the last 2 minutes count, for the same reason. The estimate averages those whose round trip is within 5 ms of the shortest, since a longer round trip is less likely to be split evenly between its two legs.
- A shared instant only lines devices up if each one also allows for its own output delay. Every device schedules a beat early by the latency its platform reports: the browser's `baseLatency + outputLatency` on web, the audio session's `outputLatency + IOBufferDuration` on iOS. Assuming zero on iOS left phones behind browsers by their whole output delay, heard as the phone playing a little late.
