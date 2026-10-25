# App Store listing draft (iOS 1.0)

Draft copy for App Store Connect. Character limits are Apple's. Check anything marked TODO before submitting.

## Name and subtitle

- Name (max 30): `Anlok`
- Subtitle (max 30): `Open your building's door` (25)

## Promotional text (max 170)

Open the door from your phone, give guests time-limited access, and see who came in and when. Works with your building's own Anlok door server. (140)

## Keywords (max 100, comma-separated, no spaces)

`door,unlock,access,entry,intercom,guest,pin,rfid,apartment,building,smart lock,key` (82)

## Description (max 4000)

Anlok opens your building's door from your phone.

It connects to your building's own door server, so you stay in control of who can get in. Once your building administrator has set you up, you sign in with your email address and open the door with a single tap.

For residents
• Open the door from the Unlock screen
• See recent door activity, including who opened it and when
• Manage your own PIN codes and RFID tags
• Get a notification when someone uses the door

For apartment administrators
• Add and remove people in your apartment
• Give guests access for specific days and times
• Choose or generate PINs for guests

For building administrators
• Manage apartments, users, PINs, RFID tags and schedules
• Search the list of people in your building
• Create API keys for integrations

Anlok is open source (MIT licence). The apps and the door server are available at github.com/jonasjancarik/anlok, so you can run your own server.

Anlok needs a door server. If you do not have one, ask your building administrator for the server address.

Notifications are optional and can be turned off at any time in Settings.

## Support and privacy

- Support URL: https://github.com/jonasjancarik/anlok/issues
- Privacy policy URL: TODO (required; must state what the server stores: email, access events, PINs, push tokens)
- Marketing URL: optional

## Category and age rating

- Primary category: Utilities (alternative: Lifestyle)
- Age rating: no objectionable content; answer "None" to all questions, including the new social media questions

## App Privacy answers (to confirm against the backend)

- Contact info (email address): collected, linked to the user, used for app functionality
- Identifiers (user ID, device push token): collected, linked to the user, app functionality
- Other usage data (door access events): collected, linked to the user, app functionality
- No tracking, no advertising, no third-party analytics

## Export compliance

Already answered in the build: `ITSAppUsesNonExemptEncryption = false`.

## Review notes (App Review Information)

Anlok normally connects to a door server that each building runs yourself, so there is no shared server and no account to give you. To review the app without one, use the built-in demo:

1. Open the app. The first screen is "Server setup".
2. Tap "Try the demo" (below the server address field).
3. The app opens with sample data as a building administrator. Try the Unlock button, the Activity tab (including denied attempts), and Settings > People, Apartments, PINs, cards and guest schedules.
4. To leave the demo, open Settings > Account and tap "Exit demo".

The demo runs entirely on the device. It has no sign-in, makes no network requests and is not connected to a door. Notifications are optional; denying the permission does not affect the app.

Sign-in required in App Store Connect: leave unticked (no account is needed).

## Screenshots

Required: 6.9-inch iPhone (1320 x 2868). iPad 13-inch is also required while `supportsTablet` is on. Suggested order: Unlock, Activity, Settings with people list, Guest schedule, Server setup.
