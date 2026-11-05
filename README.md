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

## Check the clock sync

- `npm run clock-check -- 3 12` opens 3 independent Convex clients, takes 12 clock samples each against your deployment and prints each client's offset and how far apart they are. It exits non-zero if the spread exceeds the worst-case bound.
- Open `/sync-check` on two or more devices: each runs a demo Song from the shared clock, so the big Count should change on every screen at the same moment.

## Voice cue recordings

The built-in Voice cue clips in `assets/voice/` were generated once with [ElevenLabs](https://elevenlabs.io) text-to-speech by `npm run voice-pack` (needs `ELEVENLABS_API_KEY` in `.env.tts.local`). They are trimmed to start 4 ms before the first audible sample so each word lands on its beat.

## Docs

- [CONTEXT.md](CONTEXT.md): the domain glossary
- [docs/adr](docs/adr): architecture decisions
