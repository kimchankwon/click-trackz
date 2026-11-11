# Idle Play screens go quiet

The Group fits within Convex's Free plan, whose limits cover every deployment on the team, dev included. A Play screen left open costs about 660 function calls and 0.4 MB of database I/O an hour even with nothing playing: a clock ping every 10 seconds, a presence heartbeat every 30, and a `presence:list` re-run for every Member watching each time a heartbeat lands. One forgotten screen used half the monthly call allowance and a third of the database I/O, and presence grows with the square of the Group's size while everyone is on Play.

So a Play screen spends only what the next Start needs:

- During Playback, clock pings stay every 10 seconds (ADR 0001).
- With nothing playing, clock pings run every 30 seconds, which still leaves four or more inside the two minutes of samples an estimate uses. A Start takes one fresh ping straight away.
- After 10 minutes with no Playback, the screen stops clock pings and presence heartbeats, and tells the server it left. It keeps its last clock estimate and its Playback subscription, so a Start still reaches it; it then sends a burst of four pings within the one-second Lead-in, and its beats slew or snap onto the fresh estimate. Coming back to the app or to the screen restarts the 10 minutes.
- Heartbeats run every 60 seconds and a Member counts as online for 150 seconds after the last one, halving heartbeat writes and the `presence:list` re-runs they cause.

## Considered Options

- **Keep the 10-second ping and 30-second heartbeat everywhere.** Rejected: a few idle screens exhaust the Free plan.
- **Skip the presence write on the server when nothing changed.** Rejected: the heartbeat still runs and reads, and `seenAt` has to move for the online window to work.
- **Wake on any touch as well as on Playback.** Not done yet: it needs a touch listener that works the same on native and web.

## Consequences

- A Member whose screen has sat 10 minutes without Playback shows as offline to the Group until a Start, or until they come back to the app or the screen.
- A Member who closes the app without leaving stays online for up to 150 seconds instead of 75.
- An Admin sees each Member's round trip refresh once a minute instead of every 30 seconds.
- The first beats after a long pause can land on a clock estimate that has drifted; the wake burst replaces it within a few round trips, well inside the Lead-in.
