# Offline plays on the device clock

Offline is now called My Library. It is also kept on the device, as one snapshot read whenever it opens online rather than a live subscription, so a large library is not re-read on every edit; with no connection it plays from that snapshot and cannot be edited.

Offline has no other Members to stay in step with, so its Playback never touches the server. Start, Jump and Stop use the same rules as a Group's (`src/sync/commands.ts`), but the Playback lives in the screen's state and every instant comes from the device's monotonic clock. Songs and Setlists in Offline are still ordinary Convex rows, saved to the person's account.

## Considered Options

- **Use the Group Playback mutations with the server clock.** Rejected: it needs a connection and clock pings for a timing guarantee no one else shares.
- **Keep Offline Songs on the device only.** Rejected: people want their Songs saved to their account.

## Consequences

- The "every instant comes from the Convex server clock" rule from ADR 0001 applies to Groups, not to Offline.
- Offline Playback ends when the person leaves the Play screen, since nothing else holds it.
- Offline sends no presence heartbeats or clock pings, and cannot be joined with a code.
- Offline play in a Group uses the same device-clock Playback for one Member. The Group screen keeps its server clock, presence and the Group's Playback subscription running underneath, so the Member still shows as online, sees when the Group is playing, and rejoins the Group's Playback on the server clock when they switch back.
