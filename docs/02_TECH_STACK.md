# 02 — Tech Stack

## Overview

The stack is divided into five concern areas: UI framework, state & persistence, background processing, integrations, and developer tooling.

---

## 1. Core Framework

| Library | Version (target) | Purpose |
|---------|-----------------|---------|
| `react-native` | `0.74+` | Core framework — Android only |
| `typescript` | `5.x` | Type safety throughout |
| `react` | `18.x` | UI rendering |

### Rationale: React Native (CLI, not Expo)

The Expo managed workflow does **not** support the custom native modules needed for this app (`AlarmManager`, full-screen intents, `STREAM_ALARM` audio). Use the **React Native CLI** to initialize the project, which gives full access to the `android/` directory and allows writing Kotlin native modules.

> **Do not use Expo Go or the Expo managed workflow.** If Expo is used at all, it must be the **Bare Workflow** (`expo eject` equivalent), which is essentially the same as using the CLI.

---

## 2. Navigation

| Library | Version | Purpose |
|---------|---------|---------|
| `@react-navigation/native` | `6.x` | Core navigation container |
| `@react-navigation/drawer` | `6.x` | Hamburger menu / side drawer |
| `@react-navigation/stack` | `6.x` | Stack navigation for modals and sub-screens |
| `react-native-gesture-handler` | `2.x` | Required peer dep for navigation |
| `react-native-reanimated` | `3.x` | Required peer dep for navigation animations |
| `react-native-screens` | `3.x` | Native screen optimization |
| `react-native-safe-area-context` | `4.x` | Safe area insets |

### Navigation Structure

```
Drawer Navigator
├── Stack Navigator (Home)
│   ├── HomeScreen (meeting list)
│   ├── AddMeetingModal (bottom sheet / stack modal)
│   ├── EditMeetingModal
│   └── ImportCalendarModal
├── TimersScreen
└── SettingsScreen
```

---

## 3. State Management & Persistence

| Library | Version | Purpose |
|---------|---------|---------|
| `zustand` | `4.x` | Global in-memory state (UI states, active filters) |
| `@nozbe/watermelondb` | `0.27+` | Relational SQLite database (meetings, alarms) |
| `react-native-mmkv` | `2.x` | Key-value storage for settings (synchronous, fast) |

### Why WatermelonDB over SQLite directly?

WatermelonDB is built on top of SQLite but adds:
- Lazy-loading (only reads data when a component actually observes it)
- Reactive queries using RxJS observers
- A clear migration system for schema changes
- Proper `has_many` / `belongs_to` model associations

### Why MMKV for settings?

Settings reads happen synchronously during component initialization (e.g., reading the default alarm offset when the Add Meeting modal opens). MMKV provides synchronous reads in JavaScript without blocking the UI thread, which AsyncStorage cannot do.

---

## 4. Background Processing & Android System APIs

| Library | Version | Purpose |
|---------|---------|---------|
| `@notifee/react-native` | `7.x` | Full-screen intents, notification channels, triggers |
| Custom Kotlin Module | N/A | `AlarmManager` bridge, audio on `STREAM_ALARM`, `BroadcastReceiver` |
| `react-native-background-actions` | `3.x` | WorkManager bridge for cleanup tasks |

### Why a Custom Kotlin Module?

Notifee handles displaying a high-priority notification (heads-up or full-screen intent). However, the alarm **audio** and **vibration** must use Android's `AudioAttributes.USAGE_ALARM` to respect the system's alarm volume slider — not the media volume. No JavaScript-only library handles this correctly. The Kotlin module acts as a bridge from JS to:

1. `AlarmManager.setExactAndAllowWhileIdle()` to schedule the alarm
2. The `BroadcastReceiver` that fires when the alarm triggers
3. The `AlarmActivity` (Kotlin `Activity`) that displays the full-screen overlay and manages audio playback via `MediaPlayer`

---

## 5. Audio

| Library | Version | Purpose |
|---------|---------|---------|
| Custom Kotlin `MediaPlayer` | N/A | Alarm audio on `STREAM_ALARM` |
| `react-native-system-setting` | `1.x` | Read/write Android `AudioManager.STREAM_ALARM` volume |

### Audio Architecture Decision

Do **not** use `react-native-track-player` or `react-native-sound` for alarm audio. Both libraries default to `STREAM_MUSIC`. The alarm MediaPlayer **must** be instantiated inside the native `AlarmActivity` Kotlin code using:

```kotlin
val audioAttributes = AudioAttributes.Builder()
    .setUsage(AudioAttributes.USAGE_ALARM)
    .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
    .build()
mediaPlayer.setAudioAttributes(audioAttributes)
```

---

## 6. Google Calendar Integration

| Library | Version | Purpose |
|---------|---------|---------|
| `@react-native-google-signin/google-signin` | `11.x` | OAuth2 sign-in, token management |
| `axios` | `1.x` | HTTP client for Google Calendar REST API |

### Required OAuth Scopes

```
https://www.googleapis.com/auth/calendar.readonly   (import)
https://www.googleapis.com/auth/calendar.events     (write new meetings back)
```

---

## 7. Date & Time

| Library | Version | Purpose |
|---------|---------|---------|
| `date-fns` | `3.x` | Date formatting, arithmetic, timezone handling |

**Do not use `moment.js`** — it is deprecated and adds ~300 KB to the bundle.

`date-fns` provides:
- `format(date, 'h:mm a')` for display
- `addMinutes(date, n)` for snooze calculation
- `isBefore` / `isAfter` for sorting and cleanup logic
- `parseISO` for converting GCal API ISO strings

---

## 8. File System (Custom Alarm Sound)

| Library | Version | Purpose |
|---------|---------|---------|
| `react-native-document-picker` | `9.x` | Let user pick `.mp3` / `.wav` from device |
| `react-native-fs` | `2.x` | Copy picked file into app sandbox |

**Why copy the file?** If the user picks a file from Downloads and later deletes it, the alarm sound would break. Copying it into the app's private directory (`getDocumentDirectoryPath()`) prevents this.

---

## 9. UI Utilities

| Library | Version | Purpose |
|---------|---------|---------|
| `react-native-vector-icons` | `10.x` | Icons (trash, pencil, plus, hamburger, etc.) |
| `@gorhom/bottom-sheet` | `4.x` | Modals for Add Meeting / Import Calendar |
| `react-native-haptic-feedback` | `2.x` | Vibration during alarm test |

---

## 10. Developer Tooling

| Tool | Purpose |
|------|---------|
| ESLint + `@typescript-eslint` | Linting |
| Prettier | Code formatting |
| Jest + `@testing-library/react-native` | Unit and component tests |
| Detox | End-to-end tests (alarm overlay testing) |
| Android Studio | Debugging native modules, Logcat |

---

## Complete `package.json` Dependencies Reference

```json
{
  "dependencies": {
    "@gorhom/bottom-sheet": "^4.6.0",
    "@notifee/react-native": "^7.8.0",
    "@nozbe/watermelondb": "^0.27.1",
    "@react-native-google-signin/google-signin": "^11.0.1",
    "@react-navigation/drawer": "^6.6.0",
    "@react-navigation/native": "^6.1.0",
    "@react-navigation/stack": "^6.3.0",
    "axios": "^1.6.0",
    "date-fns": "^3.3.0",
    "react": "18.2.0",
    "react-native": "0.74.0",
    "react-native-background-actions": "^3.1.0",
    "react-native-document-picker": "^9.0.0",
    "react-native-fs": "^2.20.0",
    "react-native-gesture-handler": "^2.16.0",
    "react-native-haptic-feedback": "^2.2.0",
    "react-native-mmkv": "^2.12.0",
    "react-native-reanimated": "^3.10.0",
    "react-native-safe-area-context": "^4.9.0",
    "react-native-screens": "^3.30.0",
    "react-native-system-setting": "^1.8.0",
    "react-native-vector-icons": "^10.0.0",
    "zustand": "^4.5.0"
  },
  "devDependencies": {
    "@babel/core": "^7.20.0",
    "@testing-library/react-native": "^12.0.0",
    "@typescript-eslint/eslint-plugin": "^7.0.0",
    "@typescript-eslint/parser": "^7.0.0",
    "detox": "^20.0.0",
    "eslint": "^8.57.0",
    "jest": "^29.6.0",
    "prettier": "^3.2.0",
    "typescript": "^5.3.0"
  }
}
```
