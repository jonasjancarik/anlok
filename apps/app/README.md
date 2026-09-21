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
- `EXPO_PUBLIC_GUEST_PIN_MODE` (optional, `generated` or `custom_until_scheduled`)
- `EXPO_PUBLIC_APNS_ENVIRONMENT` (optional iOS push endpoint override: `sandbox` or `production`)
- `EXPO_IOS_BUNDLE_IDENTIFIER` (required for signed iOS builds that receive APNs)
- `EXPO_ANDROID_PACKAGE` (optional Android application ID override)
- `EXPO_GOOGLE_SERVICES_FILE` (optional Android Firebase config path for native builds)

API URL notes:
- iOS simulator: `http://localhost:8000`
- Android emulator: `http://10.0.2.2:8000`
- Expo web: `EXPO_PUBLIC_API_URL` is the active server URL. Users cannot change it in the browser.
- Native Android builds allow cleartext HTTP so local and Raspberry Pi backend URLs work without TLS.

Server URL behavior:
- On native, the user enters the server URL on first launch before login.
- The native setup screen checks the server's `/health` endpoint before saving the URL.
- On native, the URL is stored locally in `AsyncStorage`, and `EXPO_PUBLIC_API_URL` only pre-fills the onboarding field.
- The Profile tab shows the active server URL and lets native users change it.
- On web, users cannot change the server URL. The hosted app uses `EXPO_PUBLIC_API_URL`.

3. Run app:

```bash
npm run ios
# or
npm run android
```

## Push Notifications

The native app registers platform push tokens with the backend:

- iOS registers an APNs device token.
- Android registers an FCM registration token.

The app does not use Expo push tokens or the Expo push relay. Android builds that
need FCM token generation must include Firebase app configuration. By default,
`app.config.js` automatically sets `expo.android.googleServicesFile` when
`google-services.json` exists at the app root; set `EXPO_GOOGLE_SERVICES_FILE`
to point at a different file. For iOS, the backend `APNS_TOPIC` must match the
app bundle identifier used for the signed build. Set `EXPO_IOS_BUNDLE_IDENTIFIER`
for iOS builds and set backend `APNS_TOPIC` to the same value.

The app explicitly disables `expo-notifications` auto server registration, so
native device tokens are sent only to this backend.

After a user enables notifications once, the app refreshes the backend
registration on app start when OS notification permission is still granted. It
also listens for native token rotation while the app is running and registers the
new APNs/FCM token with the backend.

After enabling notifications on a native build, backend delivery can be checked
without opening the door by calling `POST /notification-devices/test` with the
same user's API token. The response contains the APNs/FCM provider status for
each registered device. The Profile screen also exposes this as a "Send test
notification" action.

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
- `EXPO_PUBLIC_GUEST_PIN_MODE`
- `EXPO_PUBLIC_APNS_ENVIRONMENT`
- `EXPO_IOS_BUNDLE_IDENTIFIER`
- `EXPO_ANDROID_PACKAGE`
- `EXPO_GOOGLE_SERVICES_FILE`

Local fallback:

```bash
npm run android:doctor
npm run android:apk
npm run android:release:upload -- v1.0.0
```

## Feature Parity

- Three primary tabs on phones: Unlock, Activity, and Settings. User and apartment management live inside Settings.
- Passwordless login via magic link (`/auth/magic-links`, `/auth/tokens`)
- Unlock door (`/doors/unlock`) with an explicit request/success/failure lifecycle; deep links require confirmation before sending a command
- Settings tabs: profile, users, apartments
- User management: create/edit/delete/toggle active
- PIN management
- RFID management (+ reader endpoint)
- Guest schedule management (recurring + one-time)
- API key management (admin)
- Door activity history with granted/denied filters, focus refresh, and pull-to-refresh
- Push notification registration for access events

## Notes

- Uses `AsyncStorage` for token/user session persistence.
- Uses same backend endpoints as the web client.
