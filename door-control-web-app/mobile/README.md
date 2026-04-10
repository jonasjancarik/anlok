# Door Control React Native App

React Native (Expo) port of the door control web app.

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

- `EXPO_PUBLIC_API_URL`
- `EXPO_PUBLIC_APP_TITLE` (optional)
- `EXPO_PUBLIC_APP_SUBTITLE` (optional)

API URL notes:
- iOS simulator: `http://localhost:8000`
- Android emulator: `http://10.0.2.2:8000`

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
- Uses same backend endpoints as web app.
