# 11 — Settings

## Overview

The Settings screen is a scrollable page divided into five sections. All settings persist via MMKV (see `10_STATE_MANAGEMENT.md` and `04_DATABASE_SCHEMA.md`).

---

## Full Settings Screen Layout

```
┌─────────────────────────────────┐
│ ☰  Settings                     │
├─────────────────────────────────┤
│                                  │
│  ─── GOOGLE CALENDAR ────────── │
│                                  │
│  [Signed in as user@gmail.com]  │
│  [Sign Out]                      │
│    or                            │
│  [Sign In with Google]          │
│                                  │
│  ─── ALARM PRESETS ────────────  │
│                                  │
│  ○ 10 minutes   [🔔] [🗑]       │  ← notify toggle, delete
│  ○ 30 minutes   [  ] [🗑]       │
│  ○ 1 hour       [  ] [🗑]       │
│                                  │
│  Duration: [________] [Add]     │  ← input in minutes
│                                  │
│  ─── NOTIFICATIONS ────────────  │
│                                  │
│  Notification offset             │
│  "Notify X minutes before alarm" │
│  [    5    ] minutes             │
│                                  │
│  ─── ALARM AUDIO ──────────────  │
│                                  │
│  Alarm Sound                     │
│  [alarm_tone.mp3     ] [Browse] │
│                                  │
│  App Volume                      │
│  [━━━━━━━━━━━━━━━━] 80%         │
│  [Test Sound]                    │
│                                  │
│  Vibration                       │
│  [━━━━━━━━━━━━━━━━] 100%        │
│  [Test Vibration]                │
│                                  │
│  ─── CLEANUP ──────────────────  │
│                                  │
│  Remove events after end time    │
│  [     1     ] hour(s)          │
│                                  │
└─────────────────────────────────┘
```

---

## Section 1: Google Calendar

### Sub-components

- **Signed In State**: Displays the account email with a `[Sign Out]` button.
- **Signed Out State**: Displays a `[Sign In with Google]` styled button.

### Behavior

- **Sign In**: Calls `CalendarService.signIn()`. On success, updates `gcalSignedIn` and `gcalAccountEmail` in the settings store.
- **Sign Out**: Calls `GoogleSignin.signOut()`. Clears `gcalSignedIn` and `gcalAccountEmail`. Does **not** delete existing meetings imported from GCal.

---

## Section 2: Alarm Presets

### What it controls

The list of alarm offsets available when adding/editing a meeting. The user can add custom durations and toggle whether each offset also sends a notification.

### Sub-components

- **Preset row**: Displays a human-readable duration (see `formatDuration` util), a 🔔 toggle (notification enabled = tinted, notification disabled = grayed), and a 🗑 delete button.
- **Add new preset**: A text input (accepts numeric minutes) and an `[Add]` button. Validates that the input is a positive integer greater than 0.

### Duration Formatting

```typescript
// src/utils/formatDuration.ts
export function formatDuration(minutes: number): string {
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;

  if (hrs > 0 && mins > 0) {
    return `${hrs} hour${hrs > 1 ? 's' : ''} and ${mins} minute${mins > 1 ? 's' : ''}`;
  }

  if (hrs > 0) {
    return `${hrs} hour${hrs > 1 ? 's' : ''}`;
  }

  return `${mins} minute${mins > 1 ? 's' : ''}`;
}
```

Examples:
- `30` → `"30 minutes"`
- `60` → `"1 hour"`
- `90` → `"1 hour and 30 minutes"`
- `120` → `"2 hours"`
- `1` → `"1 minute"`

### Behavior

- **Add**: Calls `useSettingsStore.getState().addAlarmPreset({ id: uuid(), minutes: parseInt(input), notify: false })`. Clears the input field.
- **Delete**: Calls `removeAlarmPreset(id)`. Shows confirmation alert: "Remove this alarm option?"
- **Notification toggle**: Calls `togglePresetNotify(id)`. The 🔔 icon switches between filled (enabled) and outline (disabled).
- **Validation**: The input must be a positive integer. Show an inline error if invalid.
- **Minimum presets**: At least one preset must exist. The delete button is disabled (grayed) if only one preset remains.
- **Duplicate**: Prevent adding a preset with the same minute value as an existing one. Show an inline error: "This duration already exists."

---

## Section 3: Notifications

### What it controls

The notification offset — how many minutes before the alarm the notification fires.

### Sub-components

- **Numeric input**: A `TextInput` with `keyboardType="numeric"`. Minimum 1, maximum 60.

### Behavior

- Updates `notificationOffsetMinutes` in the settings store immediately on blur.
- Shows inline error if value is < 1 or > 60.
- The input box shows the raw number; the label below it says: *"Notifications will arrive X minutes before each alarm."*

---

## Section 4: Alarm Audio

### Sub-components

#### Alarm Sound
- **File picker button**: `[Browse]` → calls `DocumentPicker.pick({ type: ['audio/mpeg', 'audio/wav'] })`. After picking, copies the file to app documents directory using `RNFS.copyFile(sourcePath, destPath)`. Stores the `destPath` in settings. The file name is shown truncated in the display area.
- **Reset button** (optional icon): Resets to system default alarm sound (empties `alarmSoundPath`).

#### App Volume
- **Slider**: 0–100%, step 1. Uses a standard `Slider` component from `@react-native-community/slider`. Updates `alarmVolume` on release.
- **Test button**: Plays a 2-second clip of the current alarm sound at the configured volume level via the native `AlarmModule.testSound(volume)` method. Must use `STREAM_ALARM` audio.

#### Vibration
- **Slider**: 0–100%, step 1. Updates `vibrationIntensity`.
- **Test button**: Triggers a short vibration at the configured intensity via `AlarmModule.testVibration(intensity)`.

### Volume Architecture Note

The app-internal volume slider is a **multiplier** on top of the system alarm volume. The actual volume applied to `MediaPlayer`:

```kotlin
// In AlarmAudioManager.kt
val systemVolume = audioManager.getStreamVolume(AudioManager.STREAM_ALARM).toFloat()
val systemMaxVolume = audioManager.getStreamMaxVolume(AudioManager.STREAM_ALARM).toFloat()
val systemFraction = systemVolume / systemMaxVolume
val appVolume = readAppVolumeSetting()  // 0.0 to 1.0 from SharedPreferences
mediaPlayer.setVolume(systemFraction * appVolume, systemFraction * appVolume)
```

This preserves the user's system alarm volume while allowing app-level fine-tuning.

---

## Section 5: Cleanup

### What it controls

How long after an event's end time before the event and all its alarms are automatically removed.

### Sub-components

- **Numeric input**: Hours (integer). Minimum 0 (immediate removal after end), maximum 72.

### Behavior

- Updates `retentionHours` in settings store.
- Below the input, a description reads: *"Meetings and their alarms will be removed X hour(s) after the event ends."*
- If set to 0, events disappear from the list as soon as they end.

---

## Settings Screen Component Structure

```
SettingsScreen
├── SectionHeader ("Google Calendar")
├── GoogleCalendarSection
│   ├── SignedInView (conditional)
│   └── SignedOutView (conditional)
├── SectionHeader ("Alarm Presets")
├── AlarmPresetsSection
│   ├── PresetRow × N (FlatList)
│   └── AddPresetRow
├── SectionHeader ("Notifications")
├── NotificationOffsetSection
├── SectionHeader ("Alarm Audio")
├── AlarmAudioSection
│   ├── AlarmSoundPicker
│   ├── VolumeSlider
│   └── VibrationSlider
├── SectionHeader ("Cleanup")
└── CleanupSection
```
