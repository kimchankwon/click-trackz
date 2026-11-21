# Change-scoped verification

Status: reviewed. Unmapped files, platforms and billing coverage were decided in review (see Decisions). The tier rules and the feature map are data in `scripts/verify/feature-map.json`, so later changes are a one-file edit.

## Entry point

```
npm run verify                    # scope from the diff, then run
npm run verify -- --dry-run       # print the plan only, exit 0
npm run verify -- --full          # tier c, everything (same as `npm run verify -- all`)
npm run verify -- --only <flow>   # run named flows plus smoke, repeatable (same as `npm run verify -- <flow>`)
npm run verify -- --platform ios|web|both --label before|after
npm run verify -- --unattended    # CI or nobody to update the map: unmapped files fall back to tier c
npm run verify -- --base <ref>    # diff against another ref than origin/main
```

The scope is the set of files from `git diff --name-only origin/main...HEAD` plus uncommitted and untracked changes. Before running anything, the script prints the tier, each changed file with the rule it matched, any notes, and the exact list of checks and flows it will run.

Exit codes: 0 passed, 1 a step failed, 2 bad arguments, 3 unmapped files.

## Tiers

| Tier | When | What runs | Measured runtime |
| --- | --- | --- | --- |
| a. Static | Every changed file matches a static rule, or nothing changed | `npm run typecheck`, `npm run lint`, `npm test` | 18 seconds |
| b. Localized | Changed files match feature map areas and none matches a core rule | tier a, plus the smoke flow and the flows mapped to the changed files, on iOS and web, with screenshots of those screens. Areas with no flows (Plans, backend only, scripts) add no app launch | 2 to 3 minutes: 135 seconds for smoke plus one flow on both platforms. Each further flow adds about 35 seconds on iOS and 3 on web |
| c. Full | Any changed file matches a core rule, `--full`, or an unattended run with unmapped files | tier a, plus every flow on iOS and web, with screenshots of every screen | about 7.5 minutes with a cached dev build (437, 455 and 463 seconds over three runs). A native change adds a local rebuild: about 15 minutes cold on an M-series Mac, including prebuild and pods |

The checks always run the whole unit suite. It takes about 5 seconds, so mapping unit tests per area would save nothing; the map carries flows only.

Static rules: `**/*.md`, `docs/**`, `.github/**`, `.coderabbit.yaml`, `.vscode/**`, `eslint.config.js`, `.gitignore`, `LICENSE`, `design-refs/**`, `.claude/**`, `vercel.json`, `lint/**`, `scripts/pr-shepherd.mjs`.

## Unmapped files

When the diff has a file that matches no map rule, `verify` stops before running anything, lists the unmapped files and exits 3. The agent classifies each file as an existing area, a new area with its flows, a core rule, or static-only. It adds that entry to the feature map in the same change and reruns `verify`, which then picks the tier from the updated map. The PR report lists every map addition.

Unattended runs (`--unattended`, or the `CI` environment variable set) have nobody to update the map. They fall back to tier c and report the unmapped files in the plan and in `summary.json`, so the map gets fixed in a follow-up. A missing TTY does not count as unattended, since agents also run without one.

Globs use Node's `path.matchesGlob`. `*` and `**` do not match dot files, so dot directories are named explicitly (`public/.well-known/**`), and bracketed route segments are matched with `*` (`src/app/group/*/song/**`).

## Core rules (tier c)

- Navigation: `src/app/_layout.tsx`, `src/app/**/_layout.tsx`, `src/lib/back-or.ts`
- Auth: `src/auth/**`, `convex/auth.ts`, `convex/auth.config.ts`, `convex/devLogin.ts`, `convex/devLogin.test.ts`, `convex/http.ts`
- Data layer: `src/lib/convex.ts`, `convex/schema.ts`, `convex/access.ts`, `convex/_generated/**`, `src/lib/device-*.ts`
- App shell: app updates and stale-app recovery, `src/lib/error-text*.ts`, connection status, `src/types/**`, `public/**`
- Design system: `src/components/ui/**`, `src/components/themed-*.tsx`, `src/components/action-button.tsx`, `src/constants/theme.ts`, `src/theme/**`, `src/hooks/**`, `src/global.css`, and the helpers only `ui` uses
- Dependencies and native config: `package.json`, `package-lock.json`, `app.json`, `app.config.js`, `eas.json`, `metro.config.js`, `tsconfig.json`, `vitest.config.ts`, `fingerprint.config.js`, `modules/**`, `assets/**`
- Sync and audio core: `src/sync/clock.ts`, `src/sync/use-server-clock.ts`, `src/audio/engine.ts`
- The verify harness itself: `scripts/verify/**`

## Feature map (tier b)

| Area | Files | Flows |
| --- | --- | --- |
| Signed-out home | `src/app/index.tsx`, `src/home/**`, `src/components/group/group-list.tsx`, `src/lib/use-server-now.ts` | home-signed-out, home-signed-in |
| About | `src/app/about.tsx`, `src/components/about/**`, `src/lib/demo-*.ts` | about |
| Sign in | `src/app/dev-login.tsx` | dev-login, home-signed-in |
| My Library | `src/library/**` | home-signed-in, group |
| Group | the Group route, `src/components/group/**`, presence, chat, activity, roles, invite and the Group-only helpers in `src/lib`, `convex/groups.ts`, `convex/presence.ts`, `convex/chat.ts`, `convex/activity.ts` | group |
| Song and playback | the Song route, `src/components/song/**`, `src/components/playback/**`, song and section helpers, `src/sync/**` except the core files, `convex/songs.ts`, `convex/playback.ts` | song |
| Setlist | the Setlist route, `src/lib/setlist-next*.ts`, `convex/setlists.ts` | group |
| Sound settings | `src/components/sound/**`, `src/settings/**`, `src/app/latency.tsx`, `src/app/voice-offset.tsx`, `src/audio/**` except the core file, timing helpers, `convex/sound.ts`, `convex/speakerCheck.ts` | sound-settings |
| Join | `src/app/join/**`, `src/lib/pending-join*.ts`, `convex/guestHandoff.ts` | home-signed-in |
| Plans | `src/app/subscribe.tsx`, `src/billing/**`, `src/lib/plans*.ts`, `convex/plans.ts`, `convex/subscriptions.ts`, `convex/revenuecat.ts` | none: unit tests only for now. RevenueCat purchases cannot run against a local backend, and the plan output says so plainly |
| Screens without a flow | `src/app/+not-found.tsx`, `src/app/sync-check.tsx` | none, and the plan says so |
| Backend only | `convex/*.ts` without a screen above | none |
| Scripts | `scripts/*.mts`, `scripts/*.mjs` | none |

Every tracked file in the repo matches a rule today, so a dry run on a clean `main` reports no unmapped files.

## Flows

| Flow | Screenshot | What it proves |
| --- | --- | --- |
| smoke | `01-signed-out-home` | The app launches against the local backend and the signed-out home (the About page) renders |
| home-signed-out | `02-sign-in-choices` | Get started leads to Continue as guest and Sign in with Google |
| about | `03-about` | The About link opens `/about`. Web scrolls "From rehearsals to the stage" to the top; iOS crops to the "Every device starts on the same timing" heading and its paragraph |
| dev-login | `04-dev-login` | Dev login takes the per-run secret and signs in to the seeded account |
| home-signed-in | `05-home-signed-in` | The signed-in home lists the seeded Group under Your Groups |
| group | `06-group` | The Group opens on Play, with sound enabled so the screen does not depend on whether the tap that opened it woke the audio. The join code, the ping pill and the Admin's stage avatar are masked |
| song | `07-song` | Songs, then the library row, opens the Song editor with its Sections |
| sound-settings | `08-sound-settings` | The Sound tab shows the Mix and Speaker settings |

Each flow starts from a clean app (Maestro `clearState` and `clearKeychain`, a fresh Playwright browser context) and signs in itself when it needs to, so any subset runs on its own. Tier b and tier c run every selected flow on iOS (Maestro, `scripts/verify/maestro/`) and web (Playwright, `scripts/verify/web.spec.mts`). `--platform` narrows a manual run. There is no Android verification, ever, unless someone asks for it.

Proposed and not built yet: setlist, join.

The smoke flow runs whenever a tier launches the app.

## Environment and isolation

- Local Convex backend on 3290 and 3291 (`VERIFY_CONVEX_PORT`), started from the newest binary in `~/.cache/convex/binaries` (`VERIFY_CONVEX_BACKEND` overrides it). Its state lives in `.verify/convex/` and is wiped every run. The script generates `JWT_PRIVATE_KEY`, `JWKS`, `SITE_URL`, `DEV_LOGIN_SECRET` and `DEV_LOGIN_DEPLOYMENT` for it, deploys the functions with `--env-file` pointing at it, then seeds `admin@example.com` with the Group "Verify Group", the First Setlist and Sections on "Send Me Out". The app gets `EXPO_PUBLIC_CONVEX_URL` from the script with `.env` loading turned off, so it never talks to a cloud deployment and `.env.local` is never read or written.
- iOS simulator "iPhone 17" by default (`VERIFY_IOS_DEVICE`, a name or a UDID). The app is uninstalled and reinstalled at the start and uninstalled at the end. If the simulator was shut down, the script boots it and shuts it down again afterwards.
- Metro on 8091 for iOS and 8191 for web (`VERIFY_METRO_PORT`, `VERIFY_WEB_PORT`). The script never touches port 8081 or any process it did not start; a taken port fails the run and names the process.
- The dev build is a Debug simulator build made locally with `expo prebuild --clean` and `xcodebuild` (no EAS). It is cached under `~/Library/Caches/click-trackz-verify/ios/<fingerprint>/` (`VERIFY_CACHE_DIR`), keyed by `@expo/fingerprint`, which is also the app's runtime version, so only native changes rebuild.
- React Native core ships prebuilt in this SDK, so an `RCT_METRO_PORT` build setting has no effect and a Debug build would load JavaScript from port 8081, which is another checkout's Metro. Each Maestro launch therefore passes the launch arguments `RCT_jsLocation=localhost:<port>` and `RCT_enableDev=NO`, and the first iOS flow fails if Metro on that port did not serve a bundle. With dev mode off the iOS app runs its JavaScript the way a release does, so no LogBox toast covers the tab bar; web runs in dev mode. The flows dismiss the iOS "Save Password?" sheet after dev login when it appears. Prebuild rewrites `package.json` scripts, so the script saves `package.json` and `package-lock.json` first and restores them, even after a crash.
- Playwright's Chromium lives in the same cache folder, so other projects' `playwright install` runs cannot remove it.
- Screenshots land in `artifacts/verify/<label>/<platform>/`, with `summary.json` and `logs/` next to them.

## Crashes and reruns

Every process the script starts is recorded in `.verify/pids/<name>.json` with its start time, and runs in its own process group. Teardown on exit, SIGINT, SIGTERM or SIGHUP stops those groups. A rerun after `kill -9` first stops whatever the pid files still name, but only when the process start time matches, so a reused pid is never killed. A lock in `.verify/verify.lock`, created with an exclusive write, stops two runs in one worktree from overlapping. A stale lock from a dead run is replaced, and a run only removes a lock that names it. Xcode's DerivedData lives in `.verify/DerivedData/`, so runs in two worktrees never share build products.

## Screenshots in a PR

Run `after` on the PR head and `before` with the same flows in a worktree at the base commit, copy the base worktree's `artifacts/verify/before/` across, then run `scripts/verify/publish-screenshots.sh <folder> before after`.

If the base commit has no `scripts/verify/`, give the base worktree the harness without touching its app code. Run `git -C <base-worktree> checkout <head> -- scripts/verify package.json package-lock.json .gitignore`, then `npm ci` in that worktree. Its `package.json` now comes from the head, so a PR that changes dependencies compares the base app under the head's dependencies; say so in the report. It commits the PNGs to the `pr-screenshots` branch through a temporary index, without checking that branch out anywhere, pushes, and prints a markdown table per platform. `--dry-run` builds the commit locally and prints the table without pushing.

## Known limits

- Maestro on iOS cannot see the deeper sections of the long About page, and its scrolls land a little differently each run. The iOS About flow scrolls to "Every device starts on the same timing", and verify crops the screenshot to a fixed window measured from that heading, so it frames a different part of the page than web's. The window stops above the device mocks and the timing diagram, which animate.
- Maestro's iOS driver can be slow to start right after a long build while the machine is busy, so the driver start timeout is raised to 240 seconds.
- Maestro's iOS driver sometimes crashes with `Exception in thread "main"` (for example `kAXErrorInvalidUIElement`) and then hangs. verify stops the flow as soon as the log shows it, runs the flow once more, and prints that it did. An assertion failure is never retried. A flow that hangs for another reason fails as "timed out after 8 minutes".
- `.verify/convex/` and `.verify/maestro/` stay after a run for debugging and are wiped by the next run.
- The About and Group screenshots are pixel-identical run to run, so a pixel diff between their `before` and `after` is a real change. Other screenshots are not held to that yet: the iOS smoke screenshot can differ by a few thousand pixels between runs of the same code, so check a diff there by eye. Live values are masked in magenta (`#FF00FF`): `mask` in a flow's feature map entry lists test IDs, optionally with a fixed `width`, or an `x` counted from the right edge when negative (in points), so a mask does not change size with the text under it. `optional` marks a test ID that is only on screen some runs, such as a Member's ping bars before a ping is known. Web reads the element boxes before the screenshot. iOS reads Maestro's view hierarchy, retakes the screenshot with `simctl`, and reads the hierarchy again, and uses the screenshot only if both reads agree. `iosCrop` crops an iOS screenshot to `height` points starting `top` points from an anchor text, then aligns the window to the first row of content, kept inside the screenshot. Masking and cropping add 20 to 40 seconds per iOS flow that uses them.
- The times in Activity differ every run. No flow screenshots Activity.
- `fingerprint.config.js` keeps npm scripts and `.gitignore` out of the native fingerprint, on top of Expo's default skips, so editing them never forces a rebuild or a new runtime version. Changing `fingerprint.config.js` itself does change the fingerprint once.

## Decisions

1. Unmapped files stop the run and get mapped in the same change. Only unattended runs fall back to tier c, and they report the unmapped files.
2. Tier b and tier c run iOS and web. No Android unless asked.
3. Billing and plans (RevenueCat) are covered by unit tests only for now, and the plan output says so.
