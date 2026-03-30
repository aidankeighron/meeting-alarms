# Tech Stack Architecture: Meeting & Alarm Manager

## Core Framework
* **Frontend / UI:** React Native (CLI or Expo Bare Workflow)
* **Language:** TypeScript and JavaScript.
* **UI Declarative Framework:** React Navigation (for the Hamburger menu/Drawer and Stack navigation).

## State Management & Data Persistence
* **Global State:** Zustand (Lightweight, less boilerplate than Redux, perfect for managing the global timer list, UI states, and settings).
* **Local Database:** WatermelonDB or MMKV.
    * *WatermelonDB:* Highly recommended for relational data (Meetings -> Alarms -> Notifications). It's incredibly fast on React Native because it's lazy-loaded.
    * *MMKV:* Use this specifically for the key-value pairs in the Settings page (e.g., custom volume levels, default retention times, notification offsets) due to its synchronous, high-speed read/writes.

## Background Processing & Android System APIs
* **Notifications & Alarms:** Notifee (`@notifee/react-native`). This is the most robust library for handling background triggers, full-screen intents, and foreground services in React Native.
* **Native Bridge (Kotlin/Java):** You will need to write custom Native Modules for the core Alarm overlay. React Native's UI thread cannot reliably wake up a sleeping device, bypass the lock screen, and play audio on the `STREAM_ALARM` channel entirely from JavaScript.
* **Audio Playback:** `react-native-track-player` or a custom Kotlin module utilizing Android's `MediaPlayer` configured specifically for `AudioAttributes.USAGE_ALARM`.

## Integrations & APIs
* **Google Calendar:** * `@react-native-google-signin/google-signin` for OAuth2 authentication.
    * Standard `fetch` or Axios to interact with the Google Calendar API (`https://www.googleapis.com/calendar/v3/calendars/primary/events`).
* **Date & Time Manipulation:** `date-fns` or `dayjs`. Essential for handling the notification offsets, hour-rollover formatting, and timezone syncs with GCal. Avoid `moment.js` as it is bloated for mobile.
* **File System (Custom Alarm Sounds):** `react-native-document-picker` to allow the user to select local `.mp3` or `.wav` files, combined with `react-native-fs` to copy the selected sound into the app's local sandbox so it isn't accidentally deleted by the user later.