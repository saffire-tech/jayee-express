## Goal
Make this project runnable on Android Studio via Capacitor, with production-ready config (no sandbox hot-reload URL).

## Current state
- `@capacitor/core`, `@capacitor/cli`, `@capacitor/android`, `@capacitor/push-notifications` are already installed.
- `capacitor.config.ts` exists with `appId: com.shodel.app`, `appName: Jayee Express`, `webDir: dist`.
- It currently points `server.url` to the Lovable sandbox preview — that forces the installed Android app to load the sandbox instead of the real built web bundle. This must be removed for a real Android Studio run.
- No `android/` folder is committed (Capacitor native folders are generated locally, not by Lovable).

## Plan

### 1. Update `capacitor.config.ts`
- Remove the `server.url` / `cleartext` block so the Android app loads the bundled `dist/` web assets instead of the sandbox URL.
- Keep `appId`, `appName`, `webDir: "dist"`, and the `PushNotifications` plugin config.

### 2. Document the Android Studio run steps (README-level, no code change needed from Lovable side)
The `android/` native project must be generated on the user's own machine — Lovable's sandbox cannot run Android Studio. After pulling the repo via GitHub:

```
npm install
npm run build
npx cap add android
npx cap sync android
npx cap open android
```

Then in Android Studio: let Gradle sync, pick a device/emulator, press Run.

For later code changes the loop is:
```
npm run build
npx cap sync android
```

### 3. Notes / caveats
- Push notifications via `@capacitor/push-notifications` require Firebase setup (`google-services.json` placed in `android/app/`) — only needed when the user wants native FCM push on the device build.
- Custom `appId` `com.shodel.app` is preserved so existing FCM/Play config keeps working.
- The web bundle uses `import.meta.env.VITE_SUPABASE_*` — these are baked in at `npm run build` time, so the Android app will talk to the same Lovable Cloud backend.

## Technical summary of file changes
- `capacitor.config.ts`: drop the `server` block.

No other files need to be edited — `android/` is generated locally by `npx cap add android` and is not part of the Lovable-managed source.
