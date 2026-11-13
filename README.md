# Click Trackz

A shared cue track for bands. Every musician runs the app on their own phone or browser, an Admin presses Start, and everyone hears the same Click, sees the same Count (`VERSE1 2 3 4 | 2 2 3 4`) and gets the same spoken Voice cue one bar before each Section, aligned to one server clock.

Status: early development. The sync engine and Playback screen are being built in the open; see the pull requests for progress.

Built with Expo (iOS, Android and web from one codebase) and Convex.

## How the sync will work

Devices never receive beats over the network. Start, Jump and Stop store a future instant on the Convex server clock; each device measures its offset from that clock and computes every beat locally. See [ADR 0001](docs/adr/0001-sync-the-schedule-not-the-beats.md).

## Develop

```bash
npm install
npx convex dev
```

`npx convex dev` keeps running to sync backend changes, so start the app from a second terminal:

```bash
npm run web
```

The first time, `npx convex dev` asks you to log in and pick a deployment, then writes `.env.local` with `EXPO_PUBLIC_CONVEX_URL`. Convex Auth also needs `JWT_PRIVATE_KEY`, `JWKS` and `SITE_URL` set on the deployment; see the [Convex Auth manual setup](https://labs.convex.dev/auth/setup/manual).

```bash
npm run lint
npm run typecheck
npm test
```

## Sign-in with Google

Members can join as guests; creating a Group or holding any Role above Member needs a Google account.

1. In Google Cloud Console, create an OAuth client of type **Web application**.
2. Add the authorised redirect URI `https://<deployment>.convex.site/api/auth/callback/google` (the `EXPO_PUBLIC_CONVEX_SITE_URL` from `.env.local`, plus that path).
3. Set the credentials on the deployment:

```bash
npx convex env set AUTH_GOOGLE_ID <client id>
npx convex env set AUTH_GOOGLE_SECRET <client secret>
```

For local testing without Google, set `DEV_LOGIN_SECRET` on a **dev** deployment and `DEV_LOGIN_DEPLOYMENT` to that deployment's own `CONVEX_CLOUD_URL` (for example `https://<deployment>.ap-southeast-2.convex.cloud`), then start the app with `EXPO_PUBLIC_DEV_LOGIN=1`; `/dev-login` then signs in `@example.com` accounts with that secret. The provider only exists when both variables are set and the deployment URL matches, so a secret copied to production does nothing on its own. Never set either on production.

## Plans and subscriptions

Creating a Group needs Plus or Pro, sold through RevenueCat (see `docs/adr/0006-plans-through-revenuecat.md`).

1. In RevenueCat, create entitlements `plus` and `pro`, and offerings with the same ids, each with a monthly and an annual package.
2. Point a RevenueCat webhook at `https://<deployment>.convex.site/revenuecat` with an Authorization header of your choosing.
3. Set the server keys on each deployment:

```bash
npx convex env set REVENUECAT_SECRET_API_KEY <secret key>
npx convex env set REVENUECAT_WEBHOOK_AUTH "<the exact Authorization header>"
npx convex env set COMP_PLUS_EMAILS <comma-separated emails that get Plus free>
```

4. Once purchases work in every store, turn the limits on with `npx convex env set PLANS_ENFORCED true`. Until then nobody is limited and no Group locks.
5. Give builds the public SDK keys as `EXPO_PUBLIC_REVENUECAT_IOS_KEY`, `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY` and `EXPO_PUBLIC_REVENUECAT_WEB_KEY`. Purchases need a development build; Expo Go only previews them.

## Roles migration

After deploying the one-Admin Roles, run `npx convex run migrations:oneAdminPerGroup` once on each deployment. Each Group's creator stays Admin, other Admins become Group Managers, and a Group whose creator left goes to its longest-standing Admin.

## iOS app

iOS builds run on [EAS](https://expo.dev/accounts/xtectra/projects/cue-tracker). The `production` profile in `eas.json` uses the production Convex deployment. The `preview` profile uses the dev deployment with dev login turned on.

Build and upload to TestFlight:

```bash
npx eas-cli@latest build --platform ios --profile production --auto-submit
```

The first run asks for your Apple ID. It then creates the App Store Connect app, the distribution certificate and the provisioning profile, and stores them on EAS. Each build gets the next build number automatically. Once Apple finishes processing the build, add testers in App Store Connect under TestFlight.

## Over-the-air updates

A JavaScript-only change can reach phones without a new store build. Each build profile in `eas.json` has an EAS Update channel and an EAS environment of the same name (`production`, `preview`), and the runtime version is the native fingerprint, so an update only goes to builds with the same native code. A change to native code (a new native package, a config plugin, `app.json` native settings) still needs a new build.

Every merge to `main` is published to the `production` channel by `.github/workflows/eas-update.yml`. It waits for Vercel's production build of that commit to succeed, because that build also deploys the production Convex backend, so phones never get JavaScript that calls functions the backend doesn't have yet. It publishes only `main`'s newest commit, and needs an `EXPO_TOKEN` repository secret (an Expo access token for the `xtectra` account). Without the secret it skips with a warning. It can also be run by hand from the Actions tab on `main`; a manual run also waits for that Vercel build to have succeeded.

Publish the current commit by hand:

```bash
npm run update:production
npm run update:preview
```

`scripts/eas-update.mjs` bundles with that profile's env from `eas.json` and ignores `.env.local`, so a dev Convex URL or dev login can't leak into a production update. Extra options go after `--`, for example `npm run update:production -- --message "Fix the Count"`.

Builds made before over-the-air updates were added don't check for updates, so phones get them only after the next store build.

## Seed the first Setlist

Once your real Group exists, copy its id from the Group page URL (`/group/<id>`) and run:

```bash
npx convex run seed:firstSetlistForGroup '{"groupId":"<id>"}'
```

It adds the 15 Songs with their keys, leaders and a suggested tempo (Sections still need entering), puts them in a Setlist and marks it current. Songs whose title already exists in the Group are reused.

## Check the clock sync

- `npm run clock-check -- 3 12` opens 3 independent Convex clients, takes 12 clock samples each against your deployment and prints each client's offset and how far apart they are. It exits non-zero if the spread exceeds the worst-case bound.
- Open `/sync-check` on two or more devices: each runs a demo Song from the shared clock, so the big Count should change on every screen at the same moment.

## Voice cue recordings

The built-in Voice cue clips are in `assets/voice/<speed>/<speaker>/`, one set per Voice speed: `faster` at 1.2x and `normal` at 1.0x. They come from [ElevenLabs](https://elevenlabs.io) text-to-speech, one word or phrase per request. There are ten Speakers. Josh Kim, Sijin Yang, Aodhan King and Brooke Ligertwood are instant voice clones made with their permission, and Josh's Normal set uses a second clone (`normalVoiceId`). Every script needs `ELEVENLABS_API_KEY` in `.env.tts.local` and stays within the plan's three concurrent requests.

- `npm run voice-pack` generates only the clips that are missing, then rewrites `src/audio/builtin-voice-clips.ts`.
  - Pass a folder to write elsewhere, and `--replace` to regenerate clips that exist.
  - `--speed=faster|normal`, `--only=<speaker>,...` and `--takes=<n>` narrow a run.
  - `--retake-rising` re-records existing clips whose ending rises.
- For each clip it keeps the best of several takes that read back right. A take loses points for rising like a question, dropping off sharply, stopping abruptly, or hissing for long on a final "s".
- If no take reads back right, it tries again up to 0.1x slower, so a Faster clip is never slower than 1.1x and Normal never slows. If that still fails, the clip is left as it was, the run says which clip, and it exits with an error. It leaves the manifest unchanged while any clip is missing.
- `node --env-file=.env.tts.local scripts/check-voice-pack.mts [folder] [report.json]` transcribes every clip with speech-to-text, padded with half a second of silence so short words are not dropped, and lists any that do not read back as written.
- `scripts/reroll-voice-clips.mts <folder> <report.json>` regenerates the clips a report lists until they read back right.
- `scripts/shorten-voice-clips.mts <folder> <takes> <speed/speaker/key>...` keeps the shortest correct take.
- `scripts/try-voice-spellings.mts <folder> <word> <spelling>...` compares spellings across all Speakers. Outro is spoken from "Outtro", the shortest spelling every Speaker read back correctly.

Clips start 4 ms before the first audible sample and end 20 ms after the last sound above 3% of their peak, with a 15 ms fade. New takes also lose any breath after the word, keeping 0.1 s after the speech, and a final "s" is kept to 0.18 s. Cloned Speakers are levelled to the others' loudness. The measurements are in `scripts/voice-pack-measure.mts`. The app lines up each clip's measured onset 20 ms after its beat, and each device can move that sooner or later with its Voice cue offset.

## Docs

- [CONTEXT.md](CONTEXT.md): the domain glossary
- [docs/adr](docs/adr): architecture decisions
