# Voice cues come from a fixed vocabulary, not free-text labels

A Section is named by a Section type from a fixed vocabulary (plus an optional number), and each type maps to a pre-recorded clip in the Group's Voice pack. Free-text labels spoken by on-device text-to-speech were rejected because Web Speech and expo-speech start with 50 to 500 ms of variable delay and cannot be scheduled on the audio clock, which would break the alignment guarantee of ADR 0001. A Custom label can still change what the screen shows, but never what is spoken.

## Considered Options

- **On-device text-to-speech.** Rejected: unschedulable start delay.
- **Server-side text-to-speech rendered to a file on save.** Deferred: works for any text but needs a paid API and a network round trip per label change.
