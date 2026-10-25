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

Anlok connects to a self-hosted door server that each building runs, so it cannot be used without one. A demo server is provided for review.

- Server address: TODO (public HTTPS URL of a demo server)
- Sign-in: TODO (the normal sign-in is an emailed link, which a reviewer cannot receive; provide a demo account with a code or PIN that works without email)
- Steps: open the app, enter the server address on the first screen, sign in, tap the unlock button on the Unlock screen. The demo server simulates the door and does not control real hardware.
- Notifications are optional; denying the permission does not affect the app.

## Screenshots

Required: 6.9-inch iPhone (1320 x 2868). iPad 13-inch is also required while `supportsTablet` is on. Suggested order: Unlock, Activity, Settings with people list, Guest schedule, Server setup.
