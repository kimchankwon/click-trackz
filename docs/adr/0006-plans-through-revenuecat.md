# Plans through RevenueCat, checked on the server

Creating a Group needs a Plan, Plus or Pro, while joining one, Offline play and My Library stay free. The app ships on iOS, Android and web, and Apple and Google require their own in-app purchase for digital subscriptions sold in the app, so purchases go through RevenueCat: one SDK (`react-native-purchases`) over StoreKit, Play Billing and, on web, RevenueCat Web Billing on Stripe.

Convex never trusts the client or the webhook body about what someone bought. RevenueCat's webhook at `/revenuecat` only names who changed; Convex then reads that person's entitlements from RevenueCat's REST API with the secret key and stores the best active one in `subscriptions`. The app calls `subscriptions.refreshMine` after a purchase or restore so the new Plan shows straight away. The RevenueCat app user id is the Convex user id. The webhook syncs before it answers and returns 500 when RevenueCat cannot be read, so RevenueCat retries the delivery. Each stored result records when its RevenueCat read started, and an older read never replaces a newer one. Every hour Convex also re-reads Plans that expire within two hours (or expired in the last three days), so one lost renewal event cannot lock anyone.

## Considered Options

- **StoreKit and Play Billing directly, with our own receipt checks.** Rejected: much more code to keep current, and no web purchases.
- **Stripe on web only.** Rejected: iOS could not offer a purchase in the app, which risks App Review.
- **Trust the webhook body.** Rejected: re-reading entitlements makes a replayed or forged event harmless and keeps one code path for webhooks and the in-app refresh.

## Consequences

- Entitlement ids in RevenueCat must be `plus` and `pro`, and the app looks for offerings with the same ids, each with monthly and annual packages.
- Deployments need `REVENUECAT_SECRET_API_KEY` and `REVENUECAT_WEBHOOK_AUTH` (the exact Authorization header RevenueCat sends); builds need `EXPO_PUBLIC_REVENUECAT_IOS_KEY`, `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY` and `EXPO_PUBLIC_REVENUECAT_WEB_KEY`. Without them the Plans screen says subscriptions are unavailable, and purchases need a development build, not Expo Go.
- `COMP_PLUS_EMAILS` and `COMP_PRO_EMAILS` give listed accounts a Plan without paying, so no address lives in the repo.
- Limits count what an Admin owns: Groups they created, and Songs across those Groups, wherever a Song Manager added them. My Library counts separately.
- A Group past its Admin's Plan is Locked rather than deleted, oldest Groups staying open first. It still opens and reads, and a Playback running when it locked can still be stopped.
- Moving from several Admins to one ran as `migrations:oneAdminPerGroup`: the creator stays Admin, other Admins become Group Managers, and a Group whose creator left goes to its longest-standing Admin.
- My Library is kept on the device as one snapshot read whenever it opens online, not a live subscription, so a 1000-Song library is not re-read on every edit. Offline it plays from that snapshot and cannot be edited.
