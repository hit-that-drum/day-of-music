# Day of Music — Mobile (Expo)

Native iOS / Android client for Day of Music, built with Expo SDK 56,
Expo Router, NativeWind, and Zustand.

The web app (Next.js) and this app live in the same repo on purpose. Keep the
mobile data model in `mobile/lib/store.ts` aligned with the web model in
`src/types/music.ts` / `src/store/use-music-board-store.ts`.

## Stack

- Expo SDK 56 (React Native 0.85, React 19)
- Expo Router 56 (file-based routes under `app/`)
- NativeWind 4 + Tailwind 3 (mobile-only — web stays on Tailwind v4)
- TanStack Query + Zustand
- Supabase JS with AsyncStorage session persistence
- lucide-react-native for icons

## First-time setup

```bash
cd mobile
npm install
cp .env.example .env       # fill in EXPO_PUBLIC_SUPABASE_* values
```

You will also need to add the app icon and splash assets referenced in
`app.json`:

```
mobile/assets/icon.png            # 1024x1024
mobile/assets/adaptive-icon.png   # 1024x1024 foreground (Android)
mobile/assets/splash.png          # any size, 'contain' resize
```

Placeholders are fine for development.

## Running on iPhone

The fastest loop is **Expo Go** + your physical iPhone:

```bash
npm run start                # in mobile/
```

Scan the QR code with the Camera app on your iPhone. Expo Go will load
this app over LAN. Hot reload works as you edit screens.

When you start using native modules that aren't bundled into Expo Go (for
example, custom Supabase auth flows or push notifications), switch to a
**development build**:

```bash
npx expo install expo-dev-client
npx eas build --profile development --platform ios   # needs an Apple Developer account
```

Install the resulting `.ipa` on your iPhone via TestFlight or `eas device:register`.

## Running on the iOS Simulator

Requires Xcode 16+ installed.

```bash
npm run ios
```

The first run will prebuild a local `ios/` project (gitignored). Subsequent
runs reuse it.

## Shipping to TestFlight / App Store

1. Sign up for the Apple Developer Program ($99/yr) at https://developer.apple.com.
2. Create an app record in App Store Connect with bundle id
   `kr.co.vendys.dayofmusic` (or change the id in `app.json` to your own).
3. Fill in `submit.production.ios.ascAppId` in `eas.json`.
4. Build and submit:

   ```bash
   npx eas build --profile production --platform ios
   npx eas submit --profile production --platform ios
   ```

EAS handles certificates, provisioning profiles, and the upload to App Store
Connect. From there it's the standard TestFlight beta → App Review → release
flow.

## Relationship to the web app

The mobile app mirrors the web app's music board model, but keeps its runtime
store local to `mobile/`. This avoids Metro bundling issues with parent-project
source imports and keeps native builds predictable.

| Concept             | Web path                             | Mobile path           |
| ------------------- | ------------------------------------ | --------------------- |
| Music types         | `src/types/music.ts`                 | `mobile/lib/store.ts` |
| Board Zustand store | `src/store/use-music-board-store.ts` | `mobile/lib/store.ts` |
| `cn()` helper       | `src/lib/utils.ts`                   | `mobile/lib/utils.ts` |

The Supabase client is **not** shared: `mobile/lib/supabase.ts` uses
`EXPO_PUBLIC_*` env vars and AsyncStorage, while the web client uses
`NEXT_PUBLIC_*` and the browser cookie store. Both clients hit the same
Supabase project.

Drizzle stays server-side on the web. The mobile app talks to Supabase
directly (RLS does the auth enforcement) — do not try to import Drizzle here.

## Notes & gotchas

- **Tailwind versions are deliberately split.** Web uses Tailwind v4. Mobile
  uses Tailwind v3 because NativeWind 4 targets v3. Don't try to unify them
  until NativeWind ships official v4 support.
- **`html-to-image` is web-only.** The PNG export feature on the board will
  need a native equivalent — `react-native-view-shot` is the usual pick.
- **No Next.js APIs in mobile runtime code.** Keep `next/*`,
  `process.env.NEXT_PUBLIC_*`, and DOM globals out of `mobile/**`.
- **New Architecture is enabled** (`newArchEnabled: true` in `app.json`). If a
  third-party library breaks, that's the first knob to turn off.
