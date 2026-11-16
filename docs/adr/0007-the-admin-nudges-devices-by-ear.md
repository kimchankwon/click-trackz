# The Admin nudges devices by ear

Every device in a Group plays on the same server-clock instants (ADR 0001), but each one hears its sound late by the delay of its own output, and a Bluetooth speaker adds 100 to 250 ms that differ from speaker to speaker. The Latency nudge makes up for it, but only on the device it is set on, so a band with five Bluetooth speakers needed five people to measure and nudge one at a time.

The Admin now lines every device up from their own phone:

- Each device sends a random device id, a short name ("iPhone 16 Pro", "Chrome on Mac") and its saved Latency nudge with its presence heartbeat, and sends a heartbeat at once when the nudge changes.
- The Group tab shows the Admin a Line up speakers card listing every device with the Group open and its nudge, with the same 10 ms and 1 ms steps as the Latency nudge screen.
- A step on another device stores a nudge request on that device's presence rows. The device saves it as its own Latency nudge, tells its Member who changed it, and clears the request. The nudge stays on the device, so nothing is applied that the device's own screens do not show.
- A Speaker check stores only a future start and stop instant. Every device builds a one-Section, 60 BPM, click-only plan from them and plays it through the same engine and nudge as a Playback, so what the Admin hears is what the band will hear. Listen limits the check to one device and the Admin's own, which makes a 10 ms gap easy to hear as a double click.

## Considered Options

- **Measure every device with the Admin's microphone.** Rejected for now: it only hears speakers, not headphones or in-ears, it means asking for microphone access the app has promised not to use, and it needs a new native build.
- **Remember a nudge per Bluetooth output on each device.** Not done: each device and speaker pair still needs measuring once, and the web cannot tell outputs apart.
- **Apply the delay each device reports.** Rejected again for the reason in ADR 0001: Bluetooth reports overshoot.

## Consequences

- Only the Admin can nudge other devices or play a Speaker check. Members can still change their own nudge, which the Admin sees on the next heartbeat.
- A device must have the Group open to be nudged; one whose screen has gone quiet (ADR 0005) wakes for a Speaker check and reappears.
- A device that has not updated to this version sends no device id, so the card names its Member as needing the latest app instead of listing it.
- Each device re-runs one more small query when its own presence row changes, and the Admin re-runs a device list on every heartbeat in the Group.
