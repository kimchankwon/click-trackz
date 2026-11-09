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
An ordered list of Sections, plus whether it has a Count-in, its Clicks per beat and its Cue lead.
_Avoid_: Track, chart, arrangement

**Section**:
A run of consecutive bars sharing one Section type and one tempo, in one time signature apart from any Time changes.
_Avoid_: Part, segment, block

**Time change**:
A few bars inside a Section that play in another time signature, such as one bar of 2/4 at bar 8, before the Section's own time signature returns. A Time change has no Voice cue of its own, so a Cue lead counts straight across it, and the beat keeps its note value: a quarter note stays a quarter note.
_Avoid_: Subsection, meter change, odd bar

**Song tempo**:
The BPM every Section of a Song plays at, unless that Section has its own tempo.
_Avoid_: Default BPM, global tempo

**Own tempo**:
A Section's choice to play at its own BPM instead of the Song tempo.
_Avoid_: Override, custom BPM

**Plays**:
How many times in a row a Section plays before the Song moves on, once unless an Admin sets more. Each time through is a pass: the Voice cue speaks the Section before the first pass only, the later passes play without one, and Play shows which pass is playing.
_Avoid_: Repeats, times, loop count

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
Optional bars before the first Section, as many as the Song's Cue lead, shown with plain beat numbers while the first Section's Voice cue is spoken.
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
The spoken Section type and count before that Section. With a two-bar Cue lead it runs over the two bars before, at half time (CHORUS . 2 . | 3 . 4 . in 4/4), or over the one bar there is when the Section before it is a single bar. With a one-bar Cue lead it runs over the bar before, on every beat (CHORUS 2 3 4). Compound meters speak once per group of three either way.
_Avoid_: Guide, announcement, callout

**Cue lead**:
How many bars before a Section its Voice cue starts, one or two, chosen per Song; the Count-in is the same length. Saved with the Song and carried into Playback at Start, so every device cues alike.
_Avoid_: Pre-roll, cue offset, warning bars

**Speaker**:
One of the built-in voices that reads Voice cues and spoken counts; each Member chooses their own Speaker on their device.
_Avoid_: Voice, narrator, announcer

**Voice pack**:
The built-in recordings of the chosen Speaker that play the Voice cues and spoken counts.
_Avoid_: Samples, voice, sound bank

**Stereo split**:
A per-device choice of which ear hears the Click and which hears the Voice cues: Left, Right or Both, for split in-ear monitors.
_Avoid_: Panning, channel

**Haptic beat**:
A per-device choice to feel the downbeats, or every beat, as a tap on the phone while Play is open.
_Avoid_: Vibration, buzz

**Tap tempo**:
Setting a Song tempo by tapping along with the beat in the Song editor.
_Avoid_: Tap BPM

**Voice cue offset**:
A device's choice to play every Voice cue and spoken count a little sooner or later than its beat, in 10 ms steps, without moving the Click.
_Avoid_: Voice delay, voice latency

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
The wall-clock gap between an Admin pressing Start and the first beat, so every device is ready before it: half a second, stretched by the slowest online Member's measured round trip, never past two seconds.
_Avoid_: Count-in, pre-roll, delay

**Jump**:
The Admin command that moves Playback to another Section at the next bar line.
_Avoid_: Skip, seek, goto

**Repeat**:
The Admin command that plays the current pass of a Section once more from its end, then carries on with the Song, including any passes the Section's Plays still has to go. Being unplanned, the extra pass gets the Section's Voice cue.
_Avoid_: Again, replay

**Vamp**:
The Admin command that keeps repeating the current Section from the end of its pass until an Admin ends the vamp. The Voice cue speaks the Section before each repeat, and ending the vamp goes on to the next Section at the end of the current pass, or ends the Song on the last Section. While a Group vamps, its Playback has no end time.
_Avoid_: Loop, hold

**Play through**:
What happens when an Admin starts a Song picked from the Current setlist: the next Song in that Setlist with Sections starts a second after this one ends, with its own Count-in, and Play shows the Setlist's name in place of the Group's. A Song picked from the Song library plays on its own. A Stop ends the run, and a Vamp holds it until the vamp ends.
_Avoid_: Autoplay, continuous play, medley

**Mute**:
A Member silencing the Click and Voice cues on their own device while Play keeps showing the shared beat and Playback carries on for everyone else; Unmute brings the sound back on the next beat, and the next Start unmutes them on its own.
_Avoid_: Pause, sit out

**Started by**:
The Member who pressed Start for the current Playback, shown to everyone on Play, where their avatar beside the beat is larger and in the accent colour while it plays.
_Avoid_: Leader, host, owner

**Offline play**:
A Member's choice, on a Group's Play screen, to play the Group's Songs only on their own device, on the device's own clock. Any Member can Start, Jump and Stop it, and the Group's Playback carries on for everyone else. It ends when they switch back to the Group or leave Play.
_Avoid_: Solo, practice mode, personal Playback

**Stop**:
The Admin command that ends Playback 200 ms after it is pressed, without waiting for the bar line, so every device stops together.
_Avoid_: Pause, halt

**Stopped by**:
The Admin who pressed Stop, shown to everyone on Play once Playback has stopped, until the next Start or another Song is picked.
_Avoid_: Ended by
