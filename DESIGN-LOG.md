# Design log

A loop to raise the app's UI quality. Each round: screenshot the main screens in light and dark, have independent reviewers score Click Trackz and every app in `design-refs/` from 1 to 10 in six categories, apply the fixes they agree on, and record the result here. The loop ends when every reviewer rates Click Trackz 9 or more in every category and above every reference app.

Reviewers run read-only and are not told a target score. Rounds 1 and 2 used one Sonnet reviewer; from round 3 the reviewer is Opus at high effort.

Screenshots were captured into `design-shots/` (402 px wide at 2x, full scroll length). That folder is git-ignored and kept on the author's machine only: round 0 and round 10 in full, `final/` for the overall before/after, and `round-N/compare/` for each round's annotated sheets.

References (`design-refs/`):

| Ref | File | What it is |
|---|---|---|
| REF-A | `036b16b4ee1826b16965615c197d4706_medium.jpeg` | Orange NFT marketplace concept, three screens |
| REF-B | `1.webp` | Navy and gold metronome and practice timer, four screens |
| REF-C | `G8jJ4z_XgAE0k3n.jpeg` | Dark sleep tracker, two screens |
| REF-D | `Top-11-sources-for-stunning-mobile-app-design-ideas.jpg` | Warm grey smart home app, three screens |

## Round 1

Reviewed: `design-shots/round-0/` (the app before this loop). Reviewer: Sonnet.

| App | Hierarchy | Typography | Iconography | Color & contrast | Spacing | Consistency |
|---|---|---|---|---|---|---|
| **Click Trackz** | **4** | **5** | **2** | **5** | **5** | **5** |
| REF-A | 8 | 7 | 7 | 7 | 8 | 8 |
| REF-B | 7 | 6 | 7 | 7 | 7 | 8 |
| REF-C | 8 | 7 | 7 | 9 | 8 | 8 |
| REF-D | 8 | 7 | 7 | 8 | 8 | 8 |

Main criticism: one 2,000 px scroll of equal-weight bordered cards; almost no icons; the count and Section name too small to read mid-song; coral used for both "selected" and "primary action"; ragged button rows in the editors.

Applied (with one reviewer, every fix it listed counts as agreed, except where noted):

1. Type system: Archivo for display and headings, Archivo Narrow for the count, Figtree for body text, loaded from Google Fonts in `public/index.html`. One scale: 34 / 26 / 20 / 16 / 14 / 13 / 12 label.
2. Color tokens: added border, accent tint, inverse, danger and warning; unselected controls sit one surface step above their container.
3. Icons: Material Symbols (web, Android) and SF Symbols (iOS) through the installed `expo-symbols`, wrapped in `Icon` and `IconButton`.
4. Group screen split into Play, Songs, Sound and Group tabs with a bottom tab bar.
5. Start pinned above the tab bar and named after the Song; while playing it becomes a full-width inverse Stop.
6. Count disc: 256 px, 132 px condensed tabular count, coral rim while playing; idle shows the picked Song's BPM and meter.
7. Current Section is the page heading (34 px); "Next: Chorus" sits under it.
8. Chips: selected state is tint, outline and check; solid coral is reserved for primary actions.
9. Setlist and library rows: number column, bold title, leader, Key pill, amber dot for Songs with no Sections, chevron to edit.
10. Song editor: header with back, labelled fields, switches for Count-in and Voice cue, Section type dropdown, number stepper, icon move and remove, pinned Save, Delete as a red text button.
11. Setlist editor: Make current in the header, entry cards with icon controls, the library as a list with plus icons, pinned Save.
12. Groups and sign-in: centred welcome with a logo mark and tagline; Groups as a list with role and chevron; labelled Join and Create sections; Sign out as a text button.
13. Latency: 64 px readout, slider with a track and thumb, equal-width steps, 2x2 presets showing the match, numbered rounds, 200 px dashed tap pad, pinned Done.

Skipped or changed from the reviewer's suggestion:

- Drag handles for reordering Setlist entries and Sections: reordering by drag is new behaviour, so the arrows stay as icon buttons.
- Bottom sheet for adding Songs and an overflow menu for Delete: kept as a plain list and a red text button, so no new interaction patterns.
- Google "G" logo on the sign-in button: Google's brand mark, so a generic account icon is used.
- Stop in a red danger fill: red sits too close to the coral Start, so Stop uses the inverse (black or white) fill instead.
- Progress ring that fills through the bar: the beat dots already show position in the bar.

## Round 2

Reviewed: `design-shots/round-1/`. Reviewer: Sonnet.

| App | Hierarchy | Typography | Iconography | Color & contrast | Spacing | Consistency |
|---|---|---|---|---|---|---|
| **Click Trackz** | **6** | **7** | **6** | **6** | **7** | **7** |
| REF-A | 8 | 8 | 7 | 7 | 7 | 7 |
| REF-B | 7 | 6 | 6 | 6 | 6 | 7 |
| REF-C | 8 | 7 | 7 | 8 | 8 | 8 |
| REF-D | 7 | 7 | 7 | 7 | 7 | 7 |

Main criticism: idle tabs compete (sound banner, Start bar, equal cards); the Songs tab lists every Song twice; one chip style used for toggles, choices and selections; a white Stop glares on a dark stage; dark-mode disabled buttons vanish; both 0 ms latency presets look selected.

Applied:

1. Playing: Section name 44 px; a next line under the circle ("Next: Bridge" in coral a bar ahead, otherwise "Then Bridge" or "Last Section"); Stop outlined in coral on a dark fill.
2. Sound-off banner reduced to one 52 px row; the big Start stays on Play and becomes a mini bar (Song, status, small Start or Stop) on the other tabs.
3. Songs tab: Setlist rows show only the amber dot with one legend line; the library collapses when a Setlist exists; Edit and New are labelled 44 px buttons; titles 17 px, Key pills 15 px bold.
4. Groups: shield icon for Admin Groups, role label 14 px semibold; sign-in brand block moved into the top third, helper text 14 px.
5. Sound tab: solid 28 px slider thumb; mix toggles became switches with hints; Speaker and jump mode became segmented controls.
6. Group tab: 40 px avatars, text buttons for role changes, grey trash icons, Leave Group as an outlined deep-red button.
7. Song editor: move and remove in the Section card header; a labelled Number stepper beside the Voice cue switch; the type button shows the number.
8. Setlist editor: tighter entry cards, bordered fields, grey icons, outlined Make current.
9. Latency: 72 px readout with a 24 px unit, no duplicate value by the slider, 48 px steps, one chosen preset with a check.
10. Tokens: darker light-mode tertiary text, lighter dark-mode tertiary text, a deeper danger red distinct from the coral accent, a raised segment colour for dark mode, 1 px borders on inset fields, 12 px attribution footer.

Skipped or changed:

- Google as the filled sign-in button: most Members join as guests with a code, so guest stays primary.
- Drag handle for Sections: reordering by drag is new behaviour.
- Collapsing "No Sections yet" text behind a tap: the library keeps the text; the Setlist shows the dot with a legend.
- Moving the attribution footer into scrolling content: GetSongBPM checks for the link in the static HTML, so it stays in `public/index.html`.
- "B?" Key badge: that is the Key as written in the seeded Setlist, not a rendering bug.

## Round 3

Reviewed: `design-shots/round-2/`. Reviewer: Opus, high effort (stricter than the Sonnet rounds, so scores are not directly comparable).

| App | Hierarchy | Typography | Iconography | Color & contrast | Spacing | Consistency |
|---|---|---|---|---|---|---|
| **Click Trackz** | **6** | **7** | **7** | **7** | **6** | **6** |
| REF-A | 7 | 7 | 6 | 7 | 6 | 7 |
| REF-B | 7 | 5 | 5 | 6 | 7 | 6 |
| REF-C | 8 | 7 | 7 | 7 | 8 | 8 |
| REF-D | 8 | 7 | 7 | 8 | 7 | 8 |

Main criticism: the next cue is grey and small; the idle screen spends its biggest text on "Ready"; nearly everything is weight 700; inputs change style from screen to screen; Stop looks like Delete; red marks roles and a healthy ping instead of actions; the downbeat dot looks like the current beat.

Applied:

1. Playing order: Song name (15 px), Section (52 px), count, next cue (28 px bold with a coral arrow).
2. Disc 280 px with a 6 px coral ring while playing and a 160 px count; the beat pulse stays at the rim instead of a 60 px halo.
3. Beat dots: four equal 20 px dots, the downbeat marked by a ring; dark-mode inactive dots lifted to #48484A; dots at 30% while idle.
4. Idle: the Song title takes the 40 px slot and "Ready" became a small green status pill; BPM unit 15 px, meter 20 px.
5. Stop is a solid 64 px dark button; Delete Song, Delete Setlist and Leave Group are borderless red text buttons.
6. Ping bars coloured by state (green under 80 ms, amber to 150 ms, red above); the pill lost its fill; round back button.
7. Groups: neutral initial avatars, grey role line with a small shield for Admin.
8. Songs tab: Setlist name as a 22 px heading, coral Edit and New, one amber banner when every Song lacks Sections, fixed Key chips with a faded dash, the collapsed library as one row.
9. Sound tab: one row per sound (icon, name, switch) with its slider underneath; Speaker without a card around it; 64 px Latency row.
10. Type weights: row titles 600, chips and segments 500 (600 when selected), 700 and 800 kept for display text and primary buttons.
11. One input style: white or #2C2C2E fill, 1 px border, 12 px radius, 17 px text; sentence-case field labels.
12. Secondary buttons: light fill, border and coral text; disabled is the normal style at 40%.
13. Members and Voice pack: grey pills for role changes, 52 px recording rows with separators, coral play, red trash, a "No." field.
14. Song editor: full-width Key, Count-in as its own switch row, red Section trash set apart by a divider.
15. Setlist editor: one grouped card for all entries; library rows already in the Setlist faded with a check; Make current as a coral text button.
16. Latency: Round buttons secondary so Done is the only filled button; tap pad with a solid border on the input fill; 15 px intro.
17. Sign-in: centred with an upward bias, the official Google G on a neutral outlined button, helper text held to two even lines.

Skipped or changed:

- Song title above the Section while idle and "Ready" in green: applied, but the green pill only shows when Start is possible; otherwise it reads "No Song picked" or "Needs Sections" in grey.
- "B?" shown as B plus a superscript: it is the Key as entered, so it is shown as is.

## Round 4

Reviewed: `design-shots/round-3/`. Reviewer: Opus, high effort.

| App | Hierarchy | Typography | Iconography | Color & contrast | Spacing | Consistency |
|---|---|---|---|---|---|---|
| **Click Trackz** | **7** | **7** | **6** | **6** | **6** | **6** |
| REF-A | 7 | 6 | 6 | 8 | 5 | 7 |
| REF-B | 7 | 5 | 6 | 6 | 7 | 7 |
| REF-C | 8 | 7 | 7 | 7 | 8 | 8 |
| REF-D | 7 | 7 | 7 | 6 | 7 | 8 |

Main criticism: disabled buttons at about 2:1 contrast in three styles; the Click icon copies the app logo; the ringed downbeat dot looks like the current beat; trash drawn as the strongest icon in its row; the Setlist editor lists every Song twice; button labels switch faces and weights.

Several fixes reverse round 3 (trash colour, the downbeat ring, the role-change pill, the Edit and New treatment, the next-cue size). Where the reviewers have disagreed across rounds, the majority view is applied and the flip is noted here.

Applied:

1. Disc 320 px with a 190 px count, no outer glow; the disc dims slightly on each beat instead; idle and playing discs are the same size.
2. Next cue: a NEXT label over a 22 px semibold name, coral with "Next, in one bar" when the Voice cue is about to play; "End of Song" after the last Section.
3. Beat dots: current beat is a 20 px coral dot, others 14 px; the downbeat is darker grey (round 3 ring removed; round 1 size cue not restored, so the current beat stays unmistakable).
4. Start and Stop 56 px with 24 px side margins matching the cards; no divider above the dock.
5. One disabled style: grey fill and grey text, same shape as the enabled control.
6. Trash icons grey everywhere except the red Delete Song and Delete Setlist text buttons (Sonnet round 2 and Opus round 4 against Opus round 3).
7. Setlist editor: library shows only Songs not yet added, with "14 already in this Setlist · Show them"; tighter entries.
8. Sound tab: tempo dial icon for Click, speaking-person icon for Spoken counts, 17 px semibold row titles with 14 px hints.
9. Members: coral text buttons for role changes, inset separators. Leave Group and Sign out both neutral.
10. Groups: Join and Create both filled coral.
11. Songs tab: 28 px Setlist name on its own line, Edit and New as neutral pills, 44x32 Key chips, empty Keys leave the space blank.
12. Jump mode control 36 px with 14 px labels, no divider; idle BPM and meter on one line.
13. Song editor: Title, Key and Count-in in one card; circle badges for Section numbers; 16 px stepper value.
14. Button labels: display face 17 px bold everywhere; the Google button in the body face 16 px semibold.
15. Latency: full-width slider without a label; number badges on Round 1 and Round 2.

Skipped or changed:

- Moving the GetSongBPM line into the scrolling content: their key check reads the static HTML, and hiding the static link from people while showing it to the checker would be cloaking.
- A 3 px coral bar on the picked Song row: the row already has a tint and a check.
- Edit and New as icon-only circles: Sonnet asked for labels in round 2, so they are labelled neutral pills.
- Phosphor and Lucide icons: Material Symbols has no metronome, so Click uses the closest tempo dial (av_timer) and iOS uses SF Symbols' metronome.

## Round 5

Reviewed: `design-shots/round-4/`. Reviewer: Opus, high effort.

| App | Hierarchy | Typography | Iconography | Color & contrast | Spacing | Consistency |
|---|---|---|---|---|---|---|
| **Click Trackz** | **7** | **7** | **6** | **6** | **7** | **6** |
| REF-A | 8 | 8 | 7 | 8 | 6 | 8 |
| REF-B | 7 | 5 | 6 | 6 | 7 | 6 |
| REF-C | 8 | 7 | 7 | 7 | 8 | 8 |
| REF-D | 8 | 7 | 7 | 6 | 7 | 8 |

The same REF-A image scored 7 / 6 / 6 / 8 / 5 / 7 in round 4 and 8 / 8 / 7 / 8 / 6 / 8 here, so a single reviewer moves by one or two points between runs. From round 6 the review uses three Opus reviewers in parallel, as the loop was first planned, and only fixes that at least two of them raise are applied.

Main criticism: the disc jumps 72 px when a Song starts; future beat dots and the selected dark segment are nearly invisible; Stop is low contrast in dark mode; coral spent on secondary actions; Leave Group neutral while other destructive actions are red; three divider styles.

Applied:

1. Fixed 120 px title block above the disc in both states.
2. Dots 20 px with a 28 px current beat; distinct past and future greys in both themes; idle dots all in the future colour.
3. Dark selected segment #636366 with white text.
4. Stop in dark mode: #D1D1D6 fill with black text and icon.
5. Coral reserved for filled primary buttons, the active tab, the live beat, selection and nothing else; secondary buttons, Make current, Show them and the steps use neutral text.
6. Leave Group red like Delete Song and Delete Setlist (majority across rounds 2, 3 and 5).
7. Next cue 26 px bold with a 24 px arrow icon and a tracked 13 px label.
8. Current Section chip solid coral, 48 px tall, 12 px gaps.
9. Missing Keys show a grey dash in the Key column.
10. Setlist editor: arrows and trash on the field line, full-width 17 px titles that wrap.
11. Mix sliders start at the label column; dividers inset to it.
12. Separators start at the text column everywhere (Groups, Members, Voice pack, Mix).
13. Role icons on every role line in Groups and Members.
14. Mini player with its own surface and border, 44 px rounded Start.
15. Voice cues uses the speaking icon, Spoken counts a numbered-circle icon, the mic only for recordings.
16. Latency: the next round to do is tinted and outlined in coral, the other a quiet outline; 44 px steps.
17. Song editor: Number on its own row, Voice cue as a separate switch row; field labels 15 px medium.
18. Dark input border #48484A.

Skipped or changed:

- Key column as plain text: rounds 2 to 4 asked for chips, so chips stay and only the empty case changed.
- A Material "metronome" icon: not in the installed Material Symbols set; Click keeps the tempo dial on Android and web and the SF Symbols metronome on iOS.

## Round 6

Reviewed: `design-shots/round-5/`. Reviewers: three Opus reviewers at high effort, run independently in parallel. Only fixes raised by at least two of them were applied.

| App | Reviewer | Hierarchy | Typography | Iconography | Color & contrast | Spacing | Consistency |
|---|---|---|---|---|---|---|---|
| **Click Trackz** | 1 | **7** | **8** | **6** | **7** | **6** | **7** |
| **Click Trackz** | 2 | **7** | **7** | **7** | **6** | **7** | **6** |
| **Click Trackz** | 3 | **7** | **7** | **7** | **6** | **6** | **7** |
| REF-A | 1 / 2 / 3 | 7 / 7 / 8 | 6 / 6 / 8 | 6 / 7 / 7 | 7 / 7 / 8 | 5 / 6 / 7 | 7 / 8 / 8 |
| REF-B | 1 / 2 / 3 | 7 / 7 / 7 | 5 / 5 / 5 | 6 / 6 / 7 | 5 / 6 / 6 | 7 / 8 / 7 | 7 / 7 / 8 |
| REF-C | 1 / 2 / 3 | 8 / 8 / 8 | 7 / 7 / 7 | 7 / 7 / 7 | 8 / 7 / 8 | 8 / 7 / 8 | 8 / 8 / 8 |
| REF-D | 1 / 2 / 3 | 7 / 7 / 7 | 7 / 6 / 7 | 7 / 6 / 7 | 7 / 5 / 8 | 6 / 6 / 6 | 7 / 7 / 7 |

Applied (votes in brackets):

1. Shorter stage: disc 248 px, count 150 px, tighter gaps, so NEXT and the Section chips fit above the dock (3/3).
2. Dark Stop: #2C2C2E fill, white text, grey edge (3/3).
3. One style for Leave Group, Delete Song and Delete Setlist: centred, 17 px semibold red with an icon; Sign out stays neutral (3/3; 2 of 3 wanted red).
4. Disabled buttons: transparent with a 1 px border and readable grey text (3/3; 2 of 3 wanted this treatment).
5. Avatars coloured from one of six soft pairs chosen by the name (3/3).
6. Missing Keys: a dashed chip with a dash (3/3); inset dividers between Setlist rows (2/3).
7. The "no Sections" warning moved out of the list with a warning icon (3/3).
8. Setlist editor rows: 10 px padding, 16 px titles, 52 px Key field, 40 px icon targets, trash set apart (3/3).
9. Tap pad: coral tint with a solid coral edge and a dark label (3/3; 2 of 3 wanted the coral treatment).
10. Voice pack rows: 56 px and centred, round play button, grey trash (3/3 on rows; 2/3 on the round play and grey trash).
11. Switches green when on (2/3).
12. Ping readout 13 px grey with 12 px bars (2/3).
13. Beat dots: past dark grey, upcoming light grey (2/3).
14. Jump control about 32 px with 13 px labels (2/3).
15. Hairline above the dock and 12 px above the button (2/3).
16. Mini player without a border, 60 px tall (2/3).
17. Field labels 13 px semibold (2/3).
18. Make Member as a quiet outlined button (2/3).
19. Chosen latency preset: coral border and check on a neutral fill (2/3).
20. Idle BPM 88 px with an 18 px meter line (2/3).

Not applied (one vote only): footer moved into scrolling content, Edit and New moved to the eyebrow row, idle heading without the green pill, a transparent idle disc, a single badge style on Latency, Round 1 and 2 as a segmented control, a neutral slider fill, a higher-contrast unfilled slider track, header title size alignment, a different Click icon, a dashed Tap pad edge.

## Round 7

Reviewed: `design-shots/round-6/`. Reviewers: three Opus reviewers at high effort, in parallel. Fixes raised by at least two are applied.

| App | Reviewer | Hierarchy | Typography | Iconography | Color & contrast | Spacing | Consistency |
|---|---|---|---|---|---|---|---|
| **Click Trackz** | 1 | **7** | **8** | **7** | **7** | **7** | **7** |
| **Click Trackz** | 2 | **7** | **7** | **7** | **7** | **7** | **6** |
| **Click Trackz** | 3 | **7** | **7** | **7** | **6** | **7** | **6** |
| REF-A | 1 / 2 / 3 | 7 / 7 / 7 | 7 / 6 / 6 | 5 / 7 / 6 | 7 / 7 / 7 | 5 / 6 / 6 | 7 / 7 / 7 |
| REF-B | 1 / 2 / 3 | 6 / 6 / 6 | 4 / 5 / 5 | 6 / 6 / 6 | 5 / 7 / 6 | 7 / 7 / 7 | 5 / 6 / 7 |
| REF-C | 1 / 2 / 3 | 8 / 8 / 8 | 7 / 7 / 7 | 7 / 7 / 7 | 7 / 8 / 7 | 8 / 8 / 8 | 8 / 8 / 8 |
| REF-D | 1 / 2 / 3 | 7 / 7 / 7 | 7 / 7 / 7 | 7 / 7 / 7 | 6 / 6 / 6 | 6 / 6 / 7 | 7 / 7 / 7 |

Panel votes still flip between rounds on a few points: switches (round 6: green, 2 of 3; round 7: accent, 3 of 3) and the dark Stop (round 6: dim it, 3 of 3; round 7: brighten it, 2 of 3). The switches follow round 7. The dark Stop takes the one middle option a reviewer offered, a solid #3A3A3C with no border, so it is neither glaring nor ghosted.

Applied (votes in brackets):

1. Next cue 20 px semibold grey with an 18 px arrow; Section name 56 px, 40 px for long names (3/3).
2. Shorter stage: disc 212 px, count 124 px, idle BPM 76 px, so the Section chips clear the dock (3/3).
3. Beat dots: one grey for every beat except the current one; 24 px dots and a 32 px current dot (3/3).
4. Switches in the accent colour (3/3).
5. Disabled buttons: borderless grey fill with grey text (3/3).
6. Setlist editor Key field: 60 px, centred, dash placeholder (3/3); arrow and trash icons lighter grey (2/3).
7. Voice pack rows grouped at 56 px, 36 px round play, 20 px grey trash (3/3); Upload recording as a 15 px secondary button (3/3).
8. Secondary text darkened (#6B6F78 light); the jump caption and ping readout use the secondary grey (3/3).
9. Make Member as grey text without a border (2/3).
10. Divider above Count-in in the Song editor (2/3).
11. Latency: Round 1 and Round 2 as one segmented control; the tap pad is the only coral-bordered element (3/3 on the control, 2/3 on a calmer pad).
12. Dark Stop: solid #3A3A3C, no border (compromise, see above).

Not applied (one vote, or votes in conflict): one Start form on every tab vs a slimmer mini player; footer in scrolling content; one button face for all labels (body vs display split 1:1); filled play and stop glyphs; neutral destructive actions (round 6 chose red); amber sound banner; avatar hue spacing; sign-in vertical position; folding the library card into its label; stepper and Voice cue on one row; neutral selected preset fill.

## Round 8

Reviewed: `design-shots/round-7/`. Reviewers: three Opus reviewers at high effort, in parallel.

| App | Reviewer | Hierarchy | Typography | Iconography | Color & contrast | Spacing | Consistency |
|---|---|---|---|---|---|---|---|
| **Click Trackz** | 1 | **8** | **7** | **7** | **7** | **7** | **7** |
| **Click Trackz** | 2 | **7** | **7** | **7** | **8** | **7** | **6** |
| **Click Trackz** | 3 | **7** | **7** | **7** | **8** | **6** | **6** |
| REF-A | 1 / 2 / 3 | 7 / 7 / 6 | 7 / 6 / 6 | 6 / 6 / 6 | 7 / 7 / 7 | 5 / 5 / 5 | 7 / 7 / 7 |
| REF-B | 1 / 2 / 3 | 6 / 6 / 7 | 4 / 4 / 5 | 6 / 5 / 6 | 7 / 6 / 6 | 7 / 6 / 7 | 5 / 5 / 7 |
| REF-C | 1 / 2 / 3 | 8 / 8 / 8 | 7 / 7 / 7 | 7 / 7 / 7 | 8 / 7 / 7 | 7 / 8 / 7 | 8 / 8 / 8 |
| REF-D | 1 / 2 / 3 | 7 / 7 / 7 | 7 / 6 / 7 | 7 / 7 / 7 | 8 / 7 / 6 | 6 / 7 / 6 | 7 / 7 / 7 |

Votes flipped again on the next cue (round 7: smaller and grey, 3 of 3; round 8: larger and black, 3 of 3). It is now set at the midpoint, 24 px bold in primary text. The dark Stop follows rounds 7 and 8 (light fill, black text) over round 6.

Applied (votes in brackets):

1. Next cue 24 px bold, primary text, 22 px coral arrow (3/3, midpoint).
2. Dark Stop #F2F2F7 with black text (3/3).
3. All button labels in the body face, 17 px semibold, 15 px on small buttons (2/3).
4. Make Member as an outlined pill with primary text (3/3).
5. Song editor: Number and Voice cue on one row, no divider (3/3); up and down in one two-segment pill with red trash set apart (3/3 on grouping, 2/3 on red).
6. Setlist editor: the same reorder pill and red trash; Make current as a filled pill (3/3).
7. Missing Keys on the Songs tab as a plain dash (3/3).
8. No-Song state above the tabs as one line with no disabled button (2/3).
9. Tap pad without an outline at rest (2/3); chosen preset tinted with border and check (2/3).
10. Downbeat ring on beat 1 (2/3).
11. Idle Song title 34 px (2/3).
12. Drawn metronome glyph for Click (2/3).
13. Voice pack fields labelled Word and Number (2/3).
14. Latency slider: tick at 0 ms, fill from zero to the thumb (2/3).
15. Attribution footer 11 px with tighter padding.

Not applied: footer inside the scrolling content (not possible while it stays in the static HTML outside the app root); chevrons on Setlist rows (tapping a row picks it for Start, it does not navigate); neutral avatars (round 6 chose colour 3 of 3); a separate Guest icon; moving the join code to the Group tab; Edit and New as eyebrow links; editor header subtitles removed; Title and Key on one row; white slider thumbs; a bigger tap target for Edit and New.

## Round 9

Reviewed: `design-shots/round-8/`. Reviewers: three Opus reviewers at high effort, in parallel.

| App | Reviewer | Hierarchy | Typography | Iconography | Color & contrast | Spacing | Consistency |
|---|---|---|---|---|---|---|---|
| **Click Trackz** | 1 | **8** | **7** | **7** | **7** | **7** | **6** |
| **Click Trackz** | 2 | **8** | **7** | **7** | **7** | **8** | **7** |
| **Click Trackz** | 3 | **7** | **7** | **7** | **7** | **7** | **6** |
| REF-A | 1 / 2 / 3 | 7 / 7 / 7 | 6 / 7 / 6 | 6 / 6 / 7 | 7 / 7 / 7 | 5 / 5 / 6 | 7 / 7 / 8 |
| REF-B | 1 / 2 / 3 | 6 / 7 / 7 | 5 / 5 / 5 | 6 / 6 / 7 | 7 / 6 / 6 | 7 / 7 / 7 | 6 / 6 / 7 |
| REF-C | 1 / 2 / 3 | 8 / 8 / 8 | 7 / 7 / 7 | 7 / 7 / 6 | 8 / 8 / 7 | 8 / 8 / 8 | 8 / 8 / 8 |
| REF-D | 1 / 2 / 3 | 7 / 7 / 7 | 7 / 7 / 7 | 7 / 7 / 6 | 6 / 7 / 6 | 7 / 6 / 7 | 7 / 8 / 7 |

The dark Stop flipped again (rounds 7 and 8: light; round 9: dark, 3 of 3), as did empty Key chips (round 8: plain dash, 3 of 3; round 9: filled badge, 2 of 3). Both follow round 9.

Applied (votes in brackets):

1. Dark Stop #2C2C2E with a #48484A edge and white text (3/3).
2. Row-level trash grey everywhere; red only on the Delete Song, Delete Setlist and Leave Group text buttons (3/3).
3. Beat dots: no ring, downbeat 26 px, others 20 px, current 32 px (3/3); past beats in the bar at 35% coral (2/3).
4. Make Member as a filled pill (3/3, 2 of 3 filled).
5. Spoken counts icon: numbered list (3/3).
6. Voice cue as a 13 px field label above its switch, level with Number (3/3).
7. Empty Keys as a filled badge with a grey dash; library rows on the Setlist editor show the same badge (2/3).
8. The bar above the tabs keeps one form on every tab: a card with "No Song picked" and a disabled Start (3/3 on one height, 2/3 on the card).
9. One secondary button style: grey fill, no border (2/3).
10. Setlist editor: Make current as a full-width button under Name (2/3); 17 px titles (2/3); a right-aligned 24 px number column (2/3); 44 px fields (2/3).
11. Row titles 17 px semibold, including Latency nudge (2/3).
12. 10 px of space above the attribution footer (2/3).

Not applied: a quieter next cue (one vote this round after round 8 asked for a louder one); bigger or smaller disc (one vote each way); bigger Section chips; flat dock vs no hairline (split); join code moved to the Group tab; tab label weights; neutral avatars; white slider thumbs; filled play and stop glyphs; zero tick end labels; equal Join and Create widths; sign-in vertical position.

## Round 10

Reviewed: `design-shots/round-9/`. Reviewers: three Opus reviewers at high effort, in parallel.

| App | Reviewer | Hierarchy | Typography | Iconography | Color & contrast | Spacing | Consistency |
|---|---|---|---|---|---|---|---|
| **Click Trackz** | 1 | **8** | **8** | **7** | **7** | **7** | **8** |
| **Click Trackz** | 2 | **8** | **7** | **7** | **8** | **7** | **7** |
| **Click Trackz** | 3 | **8** | **7** | **7** | **7** | **7** | **7** |
| REF-A | 1 / 2 / 3 | 7 / 7 / 7 | 6 / 6 / 6 | 6 / 6 / 6 | 7 / 7 / 7 | 5 / 6 / 5 | 8 / 7 / 7 |
| REF-B | 1 / 2 / 3 | 7 / 7 / 7 | 4 / 5 / 5 | 5 / 6 / 6 | 6 / 6 / 5 | 6 / 7 / 7 | 6 / 5 / 6 |
| REF-C | 1 / 2 / 3 | 8 / 8 / 8 | 7 / 7 / 7 | 7 / 7 / 6 | 7 / 7 / 7 | 8 / 8 / 7 | 8 / 8 / 7 |
| REF-D | 1 / 2 / 3 | 6 / 7 / 7 | 7 / 7 / 6 | 7 / 7 / 6 | 6 / 7 / 5 | 6 / 6 / 6 | 7 / 7 / 7 |

Applied (votes in brackets):

1. Dark Stop #F2F2F7 with black text (2/3; across rounds 6 to 10 the light version has the most votes).
2. Beat dots: one 22 px size, the current beat scales up in place, downbeat ring, past beats faded coral, unlit #545458 in dark and #C7C7CC in light (2/3 on each point).
3. Jump control on one row with its caption, labels "After it" and "Next bar"; tighter Play column so the Sections card clears the dock (3/3).
4. Disabled buttons: their enabled look at 40%; Join, Create and Upload recording are coral primaries (3/3 on separating disabled from secondary, 2/3 on this treatment).
5. Dark selected segment #48484A (2/3).
6. Voice pack play and trash as matching 40 px round buttons (2/3).
7. Voice cue as a field label above its switch (2/3). This was logged in round 9 but the edit had not applied; it is now in place.
8. Round 1 phone icon, Round 2 headphones, both in the label colour (3/3).
9. Empty Keys leave the slot blank on the Songs tab (2/3).
10. Avatars cycle five hues by position, no red (2/3).
11. Ping readout without the word "Ping", grey until weak (2/3).
12. Make Member 32 px with 13 px text (2/3).
13. True minus sign on the latency steps (2/3).
14. No hairline above the dock; mini player 56 px (3/3).

Not applied: footer inside the scrolling content (not possible while it stays in the static HTML outside the app root); "Current Setlist" capitalisation (the glossary term in CONTEXT.md is "Current setlist"); a bigger count ring; a column header in the Setlist editor; removing editor subtitles; tab label weights; filled play and stop glyphs.

## Where the loop stopped

The loop was planned to run until every reviewer rated Click Trackz 9 or more in every category and above every reference. After ten rounds no reviewer had given any app a 9, and the panel kept reversing a few choices between rounds (the dark Stop, the next-cue size, empty Key chips, switch colour). The user chose to finish after round 10.

Final position (round 10 panel): Click Trackz scores 7 to 8 in every category from every reviewer. It is at or above REF-A, REF-B and REF-D in every category, and at or above REF-C in hierarchy, typography, iconography and color. REF-C stays one point ahead on spacing for two reviewers and on consistency for one.

`design-shots/final/` pairs each screen before the loop with its round 10 version.
