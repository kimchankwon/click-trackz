# Click Trackz

A shared cue track for musicians playing in the same room. Every musician follows the same click, count and voice guide on their own device, started by an Admin and aligned to one shared clock.

## People

**Group**:
A set of musicians who play together and share Songs and Playback.
_Avoid_: Band, room, session, team

**Member**:
A person in a Group who follows Playback on their own device.
_Avoid_: User, musician, player, participant

**Admin**:
A Member who can edit Songs, control Playback and make other Members Admins.
_Avoid_: Owner, leader, host, MD

**Offline**:
A person's own space for practising alone: it has Songs and Setlists like a Group, saved to their account, but no other Members, and its Playback runs only on their device, on the device's own clock.
_Avoid_: Solo, practice mode, personal Group

## Songs

**Song**:
An ordered list of Sections, plus whether it has a Count-in and its Clicks per beat.
_Avoid_: Track, chart, arrangement

**Section**:
A run of consecutive bars sharing one Section type, one tempo and one time signature.
_Avoid_: Part, segment, block

**Song tempo**:
The BPM every Section of a Song plays at, unless that Section has its own tempo.
_Avoid_: Default BPM, global tempo

**Own tempo**:
A Section's choice to play at its own BPM instead of the Song tempo.
_Avoid_: Override, custom BPM

**Section type**:
A word from the Group's Cue vocabulary plus an optional number, naming a Section and deciding which Voice cue it gets.
_Avoid_: Label, tag, name

**Cue vocabulary**:
The words a Group can use as Section types: the built-in ones (Intro, Verse, Chorus, Bridge, …), plus any other word a Song in the Group already uses.
_Avoid_: Word list, dictionary

**Custom label**:
Optional on-screen text for a Section that replaces the Section type's wording but not its Voice cue.
_Avoid_: Title, caption

**Setlist**:
A reusable, named, ordered list of Songs a Group plays together, each started by an Admin, optionally noting the Key and Leader for each Song.
_Avoid_: Set, service, playlist, plan

**Current setlist**:
The one Setlist an Admin has marked as what the Group is playing now, which Members see first.
_Avoid_: Active set, tonight's set

**Count-in**:
Two optional bars before the first Section, shown with plain beat numbers while the first Section's Voice cue is spoken.
_Avoid_: Pre-roll, lead-in, intro

## Cues

**Count**:
The token shown and spoken on a beat: the Section label on its first downbeat, the bar number on each later downbeat, and the beat number on every other beat.
_Avoid_: Cue, label, marker

**Click**:
The audible tick on every beat, plus a softer one between beats when the Song has more than one Click per beat.
_Avoid_: Metronome, beep

**Clicks per beat**:
How many Clicks a Song plays on each beat, from 1 to 4. At 2 a 3/4 bar clicks 1 . 2 . 3 ., with the downbeat accented, the other beats at full Click and each dot softer. Saved with the Song and carried into Playback at Start, so every device subdivides alike.
_Avoid_: Subdivision, eighths, double time

**Voice cue**:
The spoken Section type and count over the two bars before that Section, at half time (CHORUS . 2 . | 3 . 4 . in 4/4, once per group of three in compound meters), or over the one bar there is when the Section before it is a single bar.
_Avoid_: Guide, announcement, callout

**Speaker**:
One of the built-in voices that reads Voice cues and spoken counts; each Member chooses their own Speaker on their device.
_Avoid_: Voice, narrator, announcer

**Voice pack**:
The built-in recordings of the chosen Speaker that play the Voice cues and spoken counts.
_Avoid_: Samples, voice, sound bank

**Latency nudge**:
A per-device offset a Member sets so their Click and Voice cues line up with everyone else's despite the delay of their own audio output, such as Bluetooth headphones.
_Avoid_: Delay, offset, calibration

## Playback

**Playback**:
One run of a Song for a Group, from Start until Stop or the end of the Song.
_Avoid_: Session, performance, run

**Start**:
The Admin command that begins Playback at an agreed future instant on the shared clock.
_Avoid_: Play, go

**Lead-in**:
The wall-clock gap between an Admin pressing Start and the first beat, so every device is ready before it.
_Avoid_: Count-in, pre-roll, delay

**Jump**:
The Admin command that moves Playback to another Section at the next bar line.
_Avoid_: Skip, seek, goto

**Mute**:
A Member silencing the Click and Voice cues on their own device while Play keeps showing the shared beat and Playback carries on for everyone else; Unmute brings the sound back on the next beat, and the next Start unmutes them on its own.
_Avoid_: Pause, sit out

**Started by**:
The Member who pressed Start for the current Playback, shown to everyone on Play.
_Avoid_: Leader, host, owner

**Stop**:
The Admin command that ends Playback.
_Avoid_: Pause, halt
