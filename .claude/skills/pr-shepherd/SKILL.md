---
name: pr-shepherd
description: Open a pull request with a change report and drive it to green (CI passing, CodeRabbit with nothing actionable left, verify passing) before handing it to a human. Use for every PR in this repo, when asked to open, babysit, shepherd or finish a PR, or after pushing a fix to an open PR.
---

# PR shepherd

A PR is ready for a human only when all three hold:

1. Every CI check on the PR is green.
2. CodeRabbit has no unresolved actionable thread and has reviewed the latest push.
3. `npm run verify` passes for the diff (see the `verify` skill), and the screenshots in the description come from that run.

Never merge, never deploy, never run EAS builds or submits, never push to Convex production.

## Open the PR as a draft

Push the branch, then `gh pr create --draft --base main` with a body that holds the change report below. Dependency upgrades and `.github/` workflow changes go in their own PRs.

## The change report

Every PR description has these sections, in plain language, no em dash characters:

- **Why.** What changes for the person using the app, or for the next engineer, and why now.
- **What changed.** Short bullets. Name removed things as well as added things.
- **Checked.** Each verification step with its real result: the command, its exit code or test count, the verify tier and flows that ran, and every feature map entry the PR added (`verify` exits 3 on an unmapped file until it is mapped).
- **Screenshots.** Before and after for every screen the diff touches, as a table. Capture `before` on the base commit and `after` on the head with `npm run verify -- --label before|after`, then publish with `scripts/verify/publish-screenshots.sh <folder> before after`, which pushes to the `pr-screenshots` orphan branch and prints the markdown. Images render from `https://raw.githubusercontent.com/kimchankwon/click-trackz/pr-screenshots/<folder>/<file>.png`. A PR with no UI change says "No UI change" and names the tier that proved it.
- **Review fixes.** Added at the end: the CI failures and CodeRabbit comments fixed or declined, one line each.

## The loop

Repeat until the three conditions hold. Each round ends with the verification gate.

1. **CI.** `gh pr checks <pr> --watch`. On a failure, `gh run view <run-id> --log-failed`, reproduce it locally, fix the root cause, commit, push. Do not retry a red check without a change.
2. **CodeRabbit.** `node scripts/pr-shepherd.mjs status <pr>` lists checks, every unresolved CodeRabbit thread (id, path, line, first line, replies) and any rate-limit notice. For each thread:
   - Valid: fix it, push, then `node scripts/pr-shepherd.mjs resolve <threadId>`.
   - Not valid or out of scope: `node scripts/pr-shepherd.mjs reply <threadId> "<one-sentence reason>"`, then resolve it. Read CodeRabbit skeptically. It finds real bugs and also files nitpicks; decline noise with a concrete reason instead of churning code. Its house-rule checks (no comments, no em dash, server clock, domain terms) are always valid.
   - Also read the review bodies (`gh pr view <pr> --json reviews`), since CodeRabbit puts "outside diff range" and nitpick items there, not in threads.
3. **Rate limit.** If `status` reports `rateLimit`, CodeRabbit has not reviewed the latest push. Wait for real until `rateLimit.readyAt` (the script reads the wait from the notice, 60 minutes when it names none): one `sleep` or one scheduled wakeup, not a polling loop. Then comment `@coderabbitai review` on the PR and go back to step 2 once its review lands.
4. **Verification gate.** After every round of fixes: `npm run verify` (it scopes itself to the diff and prints the tier and the flows it runs), which includes typecheck, lint and vitest. Refresh the after screenshots if a screen changed.

When all three conditions hold, update the description (`gh pr edit <pr> --body-file <file>`) so every section matches the final head, then `gh pr ready <pr>`.

## When stuck

After two honest attempts at the same failure, stop. Put the blocker at the top of the PR description and of any report you were asked to write: what fails, the exact error, what you tried. Leave the PR as a draft.
