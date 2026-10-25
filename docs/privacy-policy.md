# Anlok privacy policy

Last updated: 25 October 2026

Anlok is an app for opening a building's door and managing who can get in. It is open source (MIT licence), and every building runs its own Anlok server. This page explains what the app and the server store, who can see it, and what you can ask for.

## Who is responsible for your data

**The person or organisation that runs your building's Anlok server is responsible for the data on it.** That is usually your building administrator. The Anlok app sends your data only to the server address you enter, and the developer of the app (Jonáš Jančařík) does not receive it, cannot see it and does not run your building's server.

If you want your data corrected or deleted, ask your building administrator first. For questions about the app itself, use the contact at the end of this page.

## What the server stores

When your building administrator adds you, the server stores:

- **Your details:** name, email address, role (building admin, apartment admin, resident or guest), apartment, and whether your account is active.
- **Access methods:** the PINs and RFID tags (cards or key fobs) set up for you. PINs and tag numbers are stored scrambled with a salted hash, so they cannot be read back. The server also keeps the last four digits of each tag and any label you or an administrator gave it, such as "Keychain".
- **Guest schedules:** the days and times a guest is allowed in.
- **Door activity:** each time the door is opened or someone tries to open it, the server records the time, how it was done (app, PIN or card), whether it was allowed, who it was, their apartment, the credential label, and the reason if it was denied.
- **Sign-in data:** a short-lived sign-in code and the session token for each device you sign in on. Both are stored as hashes.
- **Notification settings:** if you turn on notifications, your phone's push notification address, the type of phone, and whether each notification was delivered.
- **API keys:** if a building administrator creates one, a hash of the key and its description.
- **Technical logs:** the server keeps log files for troubleshooting, which can include email addresses and error messages.

## What the app stores on your phone

The app keeps the address of your server, your sign-in token, your name and role, and your display preferences, such as the look of the unlock button. This stays on your phone until you sign out or delete the app. The app has no ads, no analytics and no tracking, and it does not use your location, camera or contacts.

## How your data is used

Only to run the door system: signing you in, opening the door, showing door activity to the people allowed to see it, applying guest schedules and sending notifications you asked for. Your data is not sold, shared for advertising or used to track you.

## Who can see what

- **You** see your own details and, depending on your role, door activity.
- **Apartment admins** see and manage the people in their apartment.
- **Building admins** see and manage everyone and all door activity.
- **The server operator** can also read everything on the server, as the person who runs it.

## Services involved

- **Email:** sign-in codes are sent by email through the email service your server operator has set up. The email address and code pass through that service.
- **Push notifications:** if you turn them on, notification messages go through Apple's push notification service on iPhone and Google's Firebase Cloud Messaging on Android. The message is a short note about the door activity, such as "Keychain unlocked the door". It can include the label of the PIN or card used and, if access was denied, the reason.

Which services are used depends on how your building's server is set up.

## How long data is kept

The server does not delete door activity automatically, so it is kept until the server operator removes it. When an administrator removes a person, the operator decides what happens to that person's earlier door activity. Sign-in codes expire after 15 minutes. Session tokens expire after one year or when you sign out.

## Demo mode

"Try the demo" in the app shows made-up sample people and activity. It runs only on your phone, makes no network requests and stores nothing about you.

## Your rights

If you are in the European Union or the United Kingdom, you can ask for access to your data, correction, deletion, restriction or a copy of it, and you can object to how it is used. Because the server operator holds the data, send these requests to them first. You can also complain to your national data protection authority, such as the Czech Úřad pro ochranu osobních údajů (uoou.gov.cz).

## Security

PINs, tag numbers, sign-in codes, session tokens and API keys are stored as salted hashes. The app connects to your server over the address you give it. Use an `https://` address when the server is reachable over the internet, because a plain `http://` connection is not encrypted. Anyone who runs their own server is responsible for keeping it secure and up to date.

## Children

Anlok is not aimed at children and does not knowingly collect data from them. Accounts are created by a building administrator.

## Changes to this page

If this policy changes, the new version will replace this page with an updated date. Earlier versions are in the project's change history.

## Contact

Questions about this policy or the app: open an issue at <https://github.com/jonasjancarik/anlok/issues>.
