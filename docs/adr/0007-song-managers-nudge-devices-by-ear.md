# Song Managers nudge devices by ear

Every device in a Group plays on the same server-clock instants (ADR 0001), but each one hears its sound late by the delay of its own output, and a Bluetooth speaker adds 100 to 250 ms that differ from speaker to speaker. The Latency nudge makes up for it, but only on the device it is set on, so a band with five Bluetooth speakers needed five people to measure and nudge one at a time.

Any Song Manager or above now lines every device up from their own phone:

- Each device sends a random device id, a short name ("iPhone 16 Pro", "Chrome on Mac") and its saved Latency nudge with its presence heartbeat, and sends a heartbeat at once when the nudge changes.
- The Group tab shows Song Managers and above a Line up speakers card listing every device with the Group open and its nudge. Each device has a circle on a strip like the Latency nudge screen's, dragged to set its nudge, plus 10 ms and 1 ms steps. A drag sends at most one nudge every 120 ms and the final one on release. During a Speaker check a line sweeps across the strip on the server clock, so each circle lights as its device sends a click.
- A step on another device stores a nudge request on that device's presence rows. The device saves it as its own Latency nudge, tells its Member who changed it, and clears the request. The nudge stays on the device, so nothing is applied that the device's own screens do not show.
- A changed nudge moves the beats a device has already queued, so the next click of a Playback or Speaker check lands at the new time instead of up to half a second later. A sound that has already started keeps its time.
- A Speaker check stores only a future start and stop instant. Every device builds a one-Section, 60 BPM, click-only plan from them and plays it through the same engine and nudge as a Playback, so what the Admin hears is what the band will hear. Listen limits the check to one device and the device of whoever pressed Listen, which makes a 10 ms gap easy to hear as a double click.

## Considered Options

- **Measure every device with the Admin's microphone.** Rejected for now: it only hears speakers, not headphones or in-ears, it means asking for microphone access the app has promised not to use, and it needs a new native build.
- **Remember a nudge per Bluetooth output on each device.** Not done: each device and speaker pair still needs measuring once, and the web cannot tell outputs apart.
- **Apply the delay each device reports.** Rejected again for the reason in ADR 0001: Bluetooth reports overshoot.

## Consequences

- Song Managers, Group Managers and the Admin can nudge other devices and play a Speaker check; Playback Managers and Members cannot. Members can still change their own nudge, which shows on the card at the next heartbeat.
- A device must have the Group open to be nudged; one whose screen has gone quiet (ADR 0005) wakes for a Speaker check and reappears.
- A device that has not updated to this version sends no device id, so the card names its Member as needing the latest app instead of listing it.
- Each device re-runs one more small query when its own presence row changes, and the Admin re-runs a device list on every heartbeat in the Group.
