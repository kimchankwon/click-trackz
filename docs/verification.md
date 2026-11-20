# Change-scoped verification (provisional)

Status: provisional draft for review. The tier rules and the feature map are data in the repo, so changing them after review is a one-file edit.

## Entry point

```
npm run verify                    # scope from the diff, then run
npm run verify -- --dry-run       # print the plan only
npm run verify -- --full          # tier c, everything
npm run verify -- --only <flow>   # run named flows, repeatable
npm run verify -- --platform ios|web|both --label before|after
```

The scope is the set of files from `git diff --name-only origin/main...HEAD` plus uncommitted and untracked changes. Before running anything, the script prints the tier, the file that decided it and the rule it matched, and the exact list of checks and flows it will run. It exits non-zero if any step fails.

## Tiers

| Tier | When | What runs | Expected runtime |
| --- | --- | --- | --- |
| a. Static | Every changed file matches a static-only rule: `**/*.md`, `docs/**`, `.github/**`, `.coderabbit.yaml`, `.vscode/**`, `eslint.config.js`, `.gitignore`, `LICENSE`, `design-refs/**`, `.claude/**` | typecheck, lint, vitest | about 1 minute |
| b. Localized | Changed files match feature map entries and none matches a core rule | tier a, plus the smoke flow, plus the flows mapped to the changed files, with screenshots of those screens | 3 to 6 minutes (web), plus about 2 minutes per iOS flow once the dev build is cached |
| c. Full | Any changed file matches a core rule, any file matches no rule at all, or `--full` | tier a, plus every flow on both platforms, with screenshots of every screen | 10 to 15 minutes with a cached dev build, plus 10 to 20 minutes when the native fingerprint changed and the dev build must be rebuilt locally |

A file that matches no rule escalates to tier c. That keeps the map honest: forgetting to map a new file costs time, never coverage.

## Core rules (tier c)

- Navigation: `src/app/_layout.tsx`, `src/app/**/_layout.tsx`
- Auth: `src/auth/**`, `convex/auth.ts`, `convex/auth.config.ts`, `convex/devLogin.ts`, `convex/http.ts`
- Data layer: `src/lib/convex.ts`, `convex/schema.ts`, `convex/access.ts`, `convex/_generated/**`
- Design system: `src/components/ui/**`, `src/components/themed-*.tsx`, `src/constants/theme.ts`, `src/theme/**`, `src/hooks/**`, `src/global.css`
- Dependencies and native config: `package.json`, `package-lock.json`, `app.json`, `app.config.js`, `eas.json`, `metro.config.js`, `tsconfig.json`, `fingerprint.config.js`, `modules/**`, `assets/**`
- Sync and audio core: `src/sync/clock.ts`, `src/sync/use-server-clock.ts`, `src/audio/engine.ts`
- The verify harness itself: `scripts/verify/**`, the flow directories

## Feature map draft (tier b)

| Area | Files | Flows and screens | Unit tests |
| --- | --- | --- | --- |
| Signed-out home | `src/app/index.tsx`, `src/home/**`, `src/components/group/group-list.tsx` | smoke, home-signed-out | `src/home/*.test.ts` |
| About | `src/app/about.tsx`, `src/components/about/**`, `src/lib/demo-*.ts` | about | `src/lib/demo-*.test.ts` |
| Sign in | `src/app/dev-login.tsx` | dev-login, home-signed-in | none |
| Group | `src/app/group/[groupId]/index.tsx`, `src/components/group/**`, `src/presence/**`, `src/chat/**`, `src/activity/**`, `src/lib/roles.ts`, `src/lib/invite.ts`, `convex/groups.ts`, `convex/presence.ts`, `convex/chat.ts`, `convex/activity.ts` | group | matching `*.test.ts` next to each file |
| Song and playback | `src/app/group/[groupId]/song/**`, `src/components/song/**`, `src/components/playback/**`, `src/lib/song-*.ts`, `src/lib/section-*.ts`, `src/sync/**` except the core files, `convex/songs.ts`, `convex/playback.ts` | song | matching tests |
| Setlist | `src/app/group/[groupId]/setlist/**`, `src/lib/setlist-next.ts`, `convex/setlists.ts` | setlist (proposed) | matching tests |
| Sound settings | `src/components/sound/**`, `src/settings/**`, `src/app/latency.tsx`, `src/app/voice-offset.tsx`, `src/audio/**` except the core file, `convex/sound.ts`, `convex/speakerCheck.ts` | sound-settings | matching tests |
| Join | `src/app/join/**`, `src/lib/pending-join.ts`, `convex/guestHandoff.ts` | join (proposed) | matching tests |
| Plans | `src/app/subscribe.tsx`, `src/billing/**`, `src/lib/plans.ts`, `convex/plans.ts`, `convex/subscriptions.ts`, `convex/revenuecat.ts` | none: RevenueCat purchases cannot run against a local backend, so tier b runs unit tests only and says so | matching tests |
| Backend only | `convex/*.ts` without a screen above | none | `convex/<name>.test.ts` |
| Scripts | `scripts/*.mts`, `scripts/*.mjs` except verify | none | typecheck only |

## Flows

Built in this PR: smoke, home-signed-out, about, dev-login, home-signed-in, group, song, sound-settings. Each runs on iOS with Maestro and on web with Playwright, unless the plan says one platform.

Proposed and not built yet: setlist, join.

The smoke flow (app launches, signed-out home renders) runs whenever a tier launches the app.

## Environment and isolation

- iOS simulator "iPhone 17" by default (`VERIFY_IOS_DEVICE`). Metro on 8091, web on 8191 (`VERIFY_METRO_PORT`, `VERIFY_WEB_PORT`). The script never touches port 8081 or any process it did not start.
- Local Convex backend, wiped and seeded every run. The app never talks to a cloud deployment during verify.
- Dev build built locally (no EAS), cached by native fingerprint.
- Screenshots land in `artifacts/verify/<label>/<platform>/`, with `summary.json` next to them.

## Open questions for review

1. Is "unmapped file escalates to tier c" the right default, or should it fall back to tier b with the smoke flow only?
2. Should tier b run both platforms, or only the platform whose files changed (for example `*.web.ts` means web only)?
3. Plans and billing have no runnable flow. Is unit coverage enough there?
