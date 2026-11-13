# Click Trackz

A shared cue track for musicians playing in the same room. Every musician follows the same click, count and voice guide on their own device, started by a Playback Manager and aligned to one shared clock.

## People

**Group**:
A set of musicians who play together and share Songs and Playback.
_Avoid_: Band, room, session, team

**Member**:
A person in a Group who follows Playback on their own device. Every Member has one Role; the lowest Role is also called Member.
_Avoid_: User, musician, player, participant

**Role**:
What a Member may do in one Group. From highest to lowest: Admin, Group Manager, Song Manager, Playback Manager, Member. Each Role can do everything the Roles below it can.
_Avoid_: Permission, rank, label

**Admin**:
The Member who created the Group, and its only Admin. Only they can delete it, and only they can make Group Managers.
_Avoid_: Owner, leader, host, MD

**Group Manager**:
A Member who can rename the Group and its Members, make other Members Song Managers or Playback Managers, and remove anyone below them.
_Avoid_: Moderator, co-admin

**Song Manager**:
A Member who can edit the Group's Songs and Setlists, as well as steer Playback.
_Avoid_: Editor, arranger

**Playback Manager**:
A Member who can Start, Jump, Repeat, Vamp and Stop, and pick which Song is ready to Start, but not change Songs or Setlists.
_Avoid_: Operator, controller

**Guest**:
A Member who joined without signing in. A Guest can be a Member, Playback Manager or Song Manager, but must sign in with Google to become a Group Manager. A Guest who is a Member sees Play, Sound and the Group's Members, never the Song library or Setlists; a Guest Playback Manager or Song Manager sees them too.
_Avoid_: Anonymous, visitor

**Join Role**:
The Role a Group gives everyone who joins with its code from then on, Guests included: Member, Playback Manager or Song Manager. Member unless a Group Manager or the Admin picks another; Members who already joined keep their Role.
_Avoid_: Default role, starting role

**My Library**:
A person's own space for practising alone: it has Songs and Setlists like a Group, saved to their account and kept on their device so it plays with no connection, but no other Members, and its Playback runs only on their device, on the device's own clock.
_Avoid_: Offline, solo, practice mode, personal Group

**Activity**:
A Group's record of who did what, newest first: every Start, Jump, Repeat, Vamp and Stop, every change to a Song or Setlist and what it changed, and Members joining, leaving, being renamed or given a Role. Playback Managers and above can read it on the Group tab. My Library keeps none.
_Avoid_: Audit log, history, log

## Plans

**Plan**:
What a person's subscription lets them create: Free, Plus or Pro. Joining Groups, Offline play and My Library come with every Plan.
_Avoid_: Tier, licence, membership

**Free**:
The Plan without a subscription: no Groups of one's own, and up to 10 Songs in My Library.

**Plus**:
The Plan for up to 3 Groups of one's own with up to 100 Songs across them, and up to 1000 Songs in My Library.

**Pro**:
The Plan for any number of Groups of one's own with any number of Songs, and up to 1000 Songs in My Library.

**Locked**:
A Group its Admin's Plan no longer covers, because the subscription lapsed or a smaller Plan leaves it past the Group limit. A Locked Group can be opened and read but cannot play or change until its Admin's Plan covers it again; the Admin's earliest Groups stay open first.
_Avoid_: Frozen, suspended, disabled

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
How many times in a row a Section plays before the Song moves on, once unless a Song Manager sets more. Each time through is a pass: the Voice cue speaks the Section before the first pass only, the later passes play without one, and Play shows which pass is playing.
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
A reusable, named, ordered list of Songs a Group plays together, each started by a Playback Manager, optionally noting the Key and Leader for each Song.
_Avoid_: Set, service, playlist, plan

**Current setlist**:
The one Setlist a Song Manager has marked as what the Group is playing now, which Members see first.
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

**Voice speed**:
How quickly the chosen Speaker reads Voice cues and spoken counts: Normal, or Faster (the default) for quick tempos. Each Member chooses it with their Speaker.
_Avoid_: Talk speed, rate

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
The Playback Manager command that begins Playback at an agreed future instant on the shared clock.
_Avoid_: Play, go

**Lead-in**:
The wall-clock gap between a Playback Manager pressing Start and the first beat, so every device is ready before it: one second on the shared clock, or half a second in Offline play.
_Avoid_: Count-in, pre-roll, delay

**Jump**:
The Playback Manager command that moves Playback to another Section at the next bar line.
_Avoid_: Skip, seek, goto

**Repeat**:
The Playback Manager command that plays the current pass of a Section once more from its end, then carries on with the Song, including any passes the Section's Plays still has to go. Being unplanned, the extra pass gets the Section's Voice cue.
_Avoid_: Again, replay

**Vamp**:
The Playback Manager command that keeps repeating the current Section from the end of its pass until a Playback Manager ends the vamp. The Voice cue speaks the Section before each repeat, and ending the vamp goes on to the next Section at the end of the current pass, or ends the Song on the last Section. While a Group vamps, its Playback has no end time.
_Avoid_: Loop, hold

**Next up**:
What happens when a Song picked from the Current setlist plays to its end: Play selects the next Song in that Setlist with Sections, ready for a Playback Manager to Start, and shows the Setlist's name in place of the Group's while a Setlist Song is picked or playing. Nothing starts on its own. A Song picked from the Song library stays selected when it ends, and a Stop leaves the stopped Song selected.
_Avoid_: Play through, autoplay, auto-advance

**Mute**:
A Member silencing the Click and Voice cues on their own device while Play keeps showing the shared beat and Playback carries on for everyone else; Unmute brings the sound back on the next beat, and the next Start unmutes them on its own.
_Avoid_: Pause, sit out

**Lock screen controls**:
A per-device choice, on iPhone and iPad and on by default, to show the Song and its current Section on the lock screen and in Control Center, and steer Play from there or with a headphone press while Play is open. For a Playback Manager, play is Start and pause is Stop, and a headphone press does whichever fits; next and previous Jump one Section either way while playing, or pick the next or previous Song while idle. For a Member, pause is Mute and play is Unmute. While it is on, sound keeps playing when the app goes to the background and other apps' audio stops while Play is open. With it off, other apps' audio mixes in and this device's sound stops as soon as the app goes to the background, while Playback carries on for everyone else.
_Avoid_: Now playing, media controls, remote controls

**Started by**:
The Member who pressed Start for the current Playback, shown to everyone on Play, where their avatar beside the beat is larger and in the accent colour while it plays.
_Avoid_: Leader, host, owner

**Offline play**:
A Member's choice, on a Group's Play screen, to play the Group's Songs only on their own device, on the device's own clock. Any Member can Start, Jump and Stop it, and the Group's Playback carries on for everyone else. It ends when they switch back to the Group or leave Play.
_Avoid_: Solo, practice mode, personal Playback

**Stop**:
The Playback Manager command that ends Playback one second after it is pressed, on the shared clock and without waiting for the bar line, so every device stops together.
_Avoid_: Pause, halt

**Stopped by**:
The Playback Manager who pressed Stop, shown to everyone on Play once Playback has stopped, until the next Start or another Song is picked.
_Avoid_: Ended by
