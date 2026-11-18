# Latency nudge per Audio output

ADR 0007 set aside remembering a nudge per Bluetooth output. In practice a phone moves between its own speaker, in-ears at rehearsal and a Bluetooth speaker at home, and each move left the device on a nudge set for the wrong output: a −180 ms nudge for a Bluetooth speaker made the phone's own speaker play 180 ms early.

Each Audio output on a phone now keeps its own Latency nudge:

- The iOS output-latency module reports the current output's uid and name from `AVAudioSession.currentRoute` and sends an event on `routeChangeNotification`. The app rereads the output on that event and whenever it comes back to the foreground.
- The nudge is saved on the device under `latencyNudgeMs.<output uid>`, with every character other than letters, digits, `.` and `-` written as `_<hex code point>_` (so `40:4E` becomes `40_3a_4E`), which keeps distinct uids on distinct keys and uses only characters the device store allows. The engine takes the nudge for the output in use, so a route change during a Playback moves the queued beats exactly as a changed nudge already does (ADR 0007).
- An output with no nudge of its own uses the device-wide `latencyNudgeMs`, the value every device had before this change. Nothing moves on update, and the first nudge saved while a given output is connected belongs to that output alone.
- Each phone remembers the last 12 Audio outputs it has played through (id, name, when last used) under `audioOutputs`, rewriting the list only when an output is new, renamed, or not seen for a day. Sound settings shows the ones not connected in an Other audio outputs card: the same strip and 10 ms and 1 ms steps as the Line up speakers card, saving on release. Checking by ear and tap measuring stay on the Latency nudge screen, since they need the output connected.
- The Latency nudge screen, the Line up speakers card and a Song Manager's nudge request all read and write the nudge of the output in use at that moment. Heartbeats carry the output's name, so the card shows "iPhone 16 Pro on Sam's AirPods" and a Song Manager can tell which output a nudge will land on.

## Considered Options

- **Key by output type (Bluetooth, wired, speaker).** Rejected: two Bluetooth speakers differ by 100 ms or more, which is the case this is for.
- **Start a new output at the delay it reports.** Rejected again for the reason in ADR 0001: Bluetooth reports overshoot. The reported delay stays a recommendation.

## Consequences

- The web cannot tell outputs apart without microphone permission, so it keeps one nudge, stored under the device-wide key.
- Reading the output needs the new native module function, so older builds keep one nudge until they update; the JS checks the function exists before using it.
- A held nudge for an away device (ADR 0008) lands on whatever output that device is playing through when it next opens the Group.
- The same Bluetooth device can show up with a different uid after it is forgotten and paired again, and then starts from the device-wide nudge.
