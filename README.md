# Cue Tracker

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

## Admin sign-in with Google

Members can join as guests; creating a Group or being an Admin needs a Google account.

1. In Google Cloud Console, create an OAuth client of type **Web application**.
2. Add the authorised redirect URI `https://<deployment>.convex.site/api/auth/callback/google` (the `EXPO_PUBLIC_CONVEX_SITE_URL` from `.env.local`, plus that path).
3. Set the credentials on the deployment:

```bash
npx convex env set AUTH_GOOGLE_ID <client id>
npx convex env set AUTH_GOOGLE_SECRET <client secret>
```

For local testing without Google, set `DEV_LOGIN_SECRET` on a **dev** deployment only and start the app with `EXPO_PUBLIC_DEV_LOGIN=1`; `/dev-login` then signs in `@example.com` accounts with that secret. Never set `DEV_LOGIN_SECRET` on production.

## BPM lookup

The Song editor can look up BPM, time signature and key by title through [GetSongBPM](https://getsongbpm.com). Register for a free key, then:

```bash
npx convex env set GETSONGBPM_API_KEY <key>
```

The editor shows "BPM data from GetSongBPM" with a link back, as their terms require.

## Check the clock sync

- `npm run clock-check -- 3 12` opens 3 independent Convex clients, takes 12 clock samples each against your deployment and prints each client's offset and how far apart they are. It exits non-zero if the spread exceeds the worst-case bound.
- Open `/sync-check` on two or more devices: each runs a demo Song from the shared clock, so the big Count should change on every screen at the same moment.

## Voice cue recordings

The built-in Voice cue clips in `assets/voice/<speaker>/` (four Speakers: Adam, Alice, Charlie, Sarah) were generated once with [ElevenLabs](https://elevenlabs.io) text-to-speech by `npm run voice-pack`, which only generates clips that are missing (needs `ELEVENLABS_API_KEY` in `.env.tts.local`). They are trimmed to start 4 ms before the first audible sample so each word lands on its beat.

## Docs

- [CONTEXT.md](CONTEXT.md): the domain glossary
- [docs/adr](docs/adr): architecture decisions
