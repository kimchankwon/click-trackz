# Design log

A loop to raise the app's UI quality. Each round: screenshot the main screens in light and dark, have independent reviewers score Cue Tracker and every app in `design-refs/` from 1 to 10 in six categories, apply the fixes they agree on, and record the result here. The loop ends when every reviewer rates Cue Tracker 9 or more in every category and above every reference app.

Reviewers run read-only and are not told a target score. Rounds 1 and 2 used one Sonnet reviewer; from round 3 the reviewer is Opus at high effort.

Screenshots live in `design-shots/round-N/` (402 px wide at 2x, full scroll length). Annotated before/after sheets live in `design-shots/round-N/compare/`.

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
| **Cue Tracker** | **4** | **5** | **2** | **5** | **5** | **5** |
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
| **Cue Tracker** | **6** | **7** | **6** | **6** | **7** | **7** |
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
