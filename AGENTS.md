This is an Expo/React Native mobile application. Prioritize mobile-first patterns, performance, and cross-platform compatibility.

## Expo has changed: do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt, an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

## Commands

Use `bunx` instead of `npx` if the project uses bun (`bun.lock` present).

```bash
npx expo install <package>  # ALWAYS use instead of npm/yarn/pnpm/bun add; resolves SDK-compatible versions
npx expo start              # start the dev server
npx expo lint               # lint
npx tsc --noEmit            # typecheck
npx expo-doctor             # diagnose dependency and config issues
npx expo install --fix      # fix incompatible package versions
```

Run lint and typecheck before declaring any task done.

## Navigation & Routing

- Use **Expo Router** for all navigation. Routes live in `src/app/`; every file there is a screen, `_layout.tsx` files define navigators. Keep non-route code (components, hooks, utils) outside `src/app/`.
- Import `Link`, `router`, and `useLocalSearchParams` from `expo-router`.
- Docs: https://docs.expo.dev/router/introduction.md

## Building with EAS

Use EAS to build, sign, and submit the app in the cloud (`eas build`, `eas submit`) and to ship over-the-air updates (`eas update`), with no local Xcode or Android Studio required. Run EAS CLI as `bunx eas-cli <command>` in Bun projects, or `npx eas-cli@latest <command>` otherwise; substitute that for bare `eas` in docs examples.
Docs: https://docs.expo.dev/eas/index.md

## Rules

- If `ios/` and `android/` directories do not exist, they are generated (Continuous Native Generation). Never create or edit them by hand; configure native behavior in `app.json` and config plugins.
- Expo Go only includes its bundled native modules. After adding a library with native code, the app needs a development build: `npx expo run:ios|android` locally, or `eas build --profile development`.
- Prefer recommended Expo modules over third-party libraries, and check your available skills before adding dependencies. Docs: https://docs.expo.dev/versions/latest/index.md

## This project

Click Trackz: every Member of a Group hears the same Click, Count and Voice cue on their own device, started by an Admin.

- Read `CONTEXT.md` before naming anything. Use its terms exactly (Member, not user; Section type, not label; Lead-in vs Count-in).
- Read `docs/adr/` before touching sync, audio or the backend region.
- Backend is Convex (`convex/`), deployed in `aws-ap-southeast-2`. Run `npx convex dev` alongside `npx expo start`.

## Invariants

- Every instant that decides when a beat sounds comes from the Convex server clock. Never schedule from a client's `Date.now()` alone; use the measured server offset. Offline and Offline play are the exceptions (ADR 0004).
- Beats are never sent over the network. Start, Jump and Stop store a future instant; clients compute beats locally.
- Admin commands target a future bar line, never "now".

## Code style

- No code comments of any kind (no JSDoc, no TODOs, no section banners). Rename or restructure instead. Machine pragmas, triple-slash type references and license headers are fine.
- No em dash characters anywhere, including docs and commit messages.
- Every change lands through a pull request. `.github/` workflow changes and dependency upgrades go in their own PRs, never folded into a feature PR.
