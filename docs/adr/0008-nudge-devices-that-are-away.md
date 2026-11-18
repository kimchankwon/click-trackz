# Nudge devices that are away

ADR 0007 let Song Managers and above nudge another device, but only while it had the Group open, because a nudge request lived on the device's presence rows and those go 10 minutes after the last heartbeat. A Song Manager setting up before a rehearsal had to wait for every Member to open the app.

Each Group now remembers the devices that have opened it:

- A heartbeat that carries a device id writes a `groupDevices` row for the Group and device: its Member, short name, last reported Latency nudge and when it was last seen. The row is written only when one of those changes, or at most every 20 minutes for the last seen time, so heartbeats do not add a write each.
- A nudge request is stored on that row as well as on any presence rows the device still has. When the device next heartbeats, a request its presence row does not already hold is copied onto it, and the device applies it exactly as in ADR 0007. Saving the nudge clears the request on both.
- The Sync Audio card lists devices seen in the last month after the ones on the Group screen now, marked as not here, with "Waiting" while a nudge is held for them. They have no Listen button, since they cannot play a Speaker check.

## Consequences

- Supersedes the ADR 0007 consequence that a device must have the Group open to be nudged.
- A held nudge overwrites whatever the device's own Member set in the meantime, as soon as the device opens the Group, and the Member is told who set it.
- A held nudge is dropped, not applied, when its device comes back after more than a month away, since the card stopped listing that device and no Song Manager could see or change the nudge.
- Leaving or being removed from the Group, a Guest being swept, and deleting the Group all forget the Member's devices; a Guest who signs in with Google keeps them. A daily cron forgets devices not seen for 90 days.
- The device list query reads one more indexed table per Group.
