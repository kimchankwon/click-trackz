---
name: verify
description: Verify an app change in Click Trackz with one command, scoped to the diff. It runs typecheck, lint, vitest, Maestro flows on the iOS simulator and Playwright flows on web, against a wiped local Convex backend, and captures screenshots. Use before calling an app change done, when asked to verify, regression-test or screenshot the app, and when adding before and after screenshots to a PR.
---

# Verify

`npm run verify` decides what to run from the diff (`git diff origin/main...HEAD` plus uncommitted and untracked files), prints the plan, then runs it. The method, tiers and runtimes are in `docs/verification.md`. The rules are data in `scripts/verify/feature-map.json`.

## Run it

```bash
npm run verify -- --dry-run          # print the tier, the reasons and what would run; exit 0
npm run verify                       # scoped run, label "after"
npm run verify -- --full             # everything; same as `npm run verify -- all`
npm run verify -- --only song        # named flows plus smoke; repeatable; `npm run verify -- song` also works
npm run verify -- --platform web     # narrow a manual run to ios or web; scoped runs default to both
npm run verify -- --label before     # write to artifacts/verify/before/
```

Tier a (checks only) takes about 18 seconds, tier b 2 to 3 minutes, tier c about 7.5 minutes with a cached dev build. A native change adds a local rebuild of about 15 minutes.

Run `--dry-run` first and read the plan. It names the tier, each changed file with the rule it matched, any notes (billing is unit tests only), and the exact checks and flows.

Exit codes: 0 passed, 1 a step failed, 2 bad arguments, 3 unmapped files.

## When it exits 3

A changed file matches no rule in `scripts/verify/feature-map.json`. Nothing ran. For each file the plan lists:

1. Decide what it is: part of an existing area, a new area (with the flows that show it), a core rule (shared by every screen), or static (never affects the running app).
2. Add the glob to the map in the same change. Globs use `path.matchesGlob`: `*` and `**` skip dot files, so name dot directories explicitly, and match bracketed route segments with `*` (`src/app/group/*/song/**`).
3. Rerun `npm run verify`.

List every map addition in the PR report. `--unattended` (or `CI` set) skips the stop and runs the full tier instead, reporting the unmapped files in the plan and `summary.json`; use it only when nobody can update the map.

## Read the results

- The terminal prints each step with pass or FAIL and the log path.
- `artifacts/verify/<label>/summary.json` has the tier, reasons, unmapped files, notes and every step with `ok`, `durationMs`, `screenshot` and `log`.
- Screenshots: `artifacts/verify/<label>/<ios|web>/<NN-screen>.png`, numbered by `flows` in the feature map.
- Logs: `artifacts/verify/<label>/logs/`. Maestro writes `ios-<flow>.log` and its own output under `.verify/maestro/<flow>/`. Playwright writes `web-playwright.log` and failure context under `logs/playwright-output/`.

Look at the screenshots of the screens you changed before calling the change done. A pass means the flow's selectors matched, not that the screen looks right.

## Before and after screenshots for a PR

1. `after`: on the PR head, `npm run verify -- --label after`.
2. `before`: in a worktree at the base commit, run the same flows with `npm run verify -- --only <flow> ... --label before`, then copy that worktree's `artifacts/verify/before/` into this one.
3. `scripts/verify/publish-screenshots.sh --dry-run <folder> before after` shows what it would push. Without `--dry-run` it commits the PNGs to the `pr-screenshots` branch through a temporary index (it never checks the branch out), pushes, and prints a markdown table of `raw.githubusercontent.com` images per platform. Paste the table into the PR description.

## What it touches

It starts its own local Convex backend (port 3290 and 3291, state in `.verify/convex/`, wiped per run), Metro on 8091 for iOS and 8191 for web, and installs a fresh dev build on the simulator named by `VERIFY_IOS_DEVICE` (default `iPhone 17`). It never talks to a cloud Convex deployment, never edits `.env.local`, and only stops processes it recorded in `.verify/pids/`. If a port is taken by something else it fails and names the process; it does not kill it. A rerun after a crash or `kill -9` cleans up what the last run left.

The dev build is built locally (prebuild plus xcodebuild, no EAS) and cached by native fingerprint under `~/Library/Caches/click-trackz-verify/`, so only native changes pay for a rebuild.
