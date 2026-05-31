# Anlok App

Expo / React Native client for Anlok.

## Setup

1. Install deps:

```bash
npm install
```

2. Configure env:

```bash
cp .env.example .env
```

Required keys:

- `EXPO_PUBLIC_API_URL` (optional native onboarding suggestion, required for hosted web)
- `EXPO_PUBLIC_APP_TITLE` (optional)
- `EXPO_PUBLIC_APP_SUBTITLE` (optional)
- `EXPO_PUBLIC_SENDER_EMAIL` (optional, enables Gmail shortcut)
- `EXPO_PUBLIC_REQUIRED_PIN_LENGTH` (optional, defaults to `4`)
- `EXPO_PUBLIC_EAS_PROJECT_ID` (optional fallback for push notifications; EAS builds can infer this)

API URL notes:
- iOS simulator: `http://localhost:8000`
- Android emulator: `http://10.0.2.2:8000`
- Expo web: `EXPO_PUBLIC_API_URL` is the active server URL. Users cannot change it in the browser.

Server URL behavior:
- On native, the user enters the server URL on first launch before login.
- On native, the URL is stored locally in `AsyncStorage`, and `EXPO_PUBLIC_API_URL` only pre-fills the onboarding field.
- On web, users cannot change the server URL. The hosted app uses `EXPO_PUBLIC_API_URL`.

3. Run app:

```bash
npm run ios
# or
npm run android
```

## Android APK Releases

GitHub Actions can build a release APK and attach it to a GitHub Release:

1. Commit the release changes and create a tag, for example `v1.0.0`.
2. Push the tag to GitHub.
3. Run the `Release Android APK` workflow with that tag.

The uploaded asset is named `anlok-v1.0.0.apk`. If the asset already exists on the release, the workflow skips the build.

Optional GitHub Actions variables or secrets:

- `EXPO_PUBLIC_API_URL`
- `EXPO_PUBLIC_APP_TITLE`
- `EXPO_PUBLIC_APP_SUBTITLE`
- `EXPO_PUBLIC_SENDER_EMAIL`
- `EXPO_PUBLIC_REQUIRED_PIN_LENGTH`
- `EXPO_PUBLIC_EAS_PROJECT_ID`

Local fallback:

```bash
npm run android:doctor
npm run android:apk
npm run android:release:upload -- v1.0.0
```

## Feature Parity

- Passwordless login via magic link (`/auth/magic-links`, `/auth/tokens`)
- Unlock door (`/doors/unlock`)
- Settings tabs: profile, users, apartments
- User management: create/edit/delete/toggle active
- PIN management
- RFID management (+ reader endpoint)
- Guest schedule management (recurring + one-time)
- API key management (admin)
- Door activity history
- Push notification registration for access events

## Notes

- Uses `AsyncStorage` for token/user session persistence.
- Uses same backend endpoints as the web client.
