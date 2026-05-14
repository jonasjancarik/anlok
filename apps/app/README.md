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

## Feature Parity

- Passwordless login via magic link (`/auth/magic-links`, `/auth/tokens`)
- Unlock door (`/doors/unlock`)
- Settings tabs: profile, users, apartments
- User management: create/edit/delete/toggle active
- PIN management
- RFID management (+ reader endpoint)
- Guest schedule management (recurring + one-time)
- API key management (admin)

## Notes

- Uses `AsyncStorage` for token/user session persistence.
- Uses same backend endpoints as the web client.
