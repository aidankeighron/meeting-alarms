# 15 — Implementation Plan

## Overview

This document provides a phased, step-by-step build plan. Each phase builds on the previous and results in a testable milestone. An agent should complete every task in a phase before moving to the next.

---

## Prerequisites

Before writing any code:

1. **Google Cloud Console**: Create a project, enable the Google Calendar API, and create OAuth 2.0 credentials. Note the `webClientId`.
2. **`.env` file**: Create `.env` in the project root with `GCAL_WEB_CLIENT_ID=your_id_here`. Add `.env` to `.gitignore`.
3. **Android SDK**: Install Android Studio, ensure Android SDK API 34 is installed.
4. **Physical Device**: Prepare a physical Android device running API 34 for alarm testing. Emulators have notoriously unreliable alarm and lock-screen behavior.

---

## Phase 0: Project Bootstrap

**Goal**: Runnable "Hello World" on Android device with all dependencies installed.

```
[ ] Initialize React Native CLI project:
    npx react-native@latest init MeetingAlarms --template react-native-template-typescript

[ ] Update android/build.gradle: set minSdkVersion = 26, targetSdkVersion = 34, compileSdkVersion = 34

[ ] Install all dependencies from 02_TECH_STACK.md (npm install)

[ ] Configure react-native-vector-icons for Android:
    - Add to android/app/build.gradle: apply from "../../node_modules/react-native-vector-icons/fonts.gradle"

[ ] Add Inter font files to android/app/src/main/assets/fonts/

[ ] Install react-native-reanimated:
    - Add Babel plugin to babel.config.js
    - Add reanimated.init() to MainApplication.kt

[ ] Verify build: npx react-native run-android
    Expected: White screen with "Hello World" or default template
```

---

## Phase 1: Design System Foundation

**Goal**: Visual tokens and base components ready. No logic yet.

```
[ ] Create src/theme/colors.ts (from 13_DESIGN_SYSTEM.md)
[ ] Create src/theme/typography.ts
[ ] Create src/theme/spacing.ts

[ ] Set dark background on MainActivity:
    - In styles.xml, set windowBackground to #0F0F14

[ ] Build AppButton.tsx (primary and outlined variants)
[ ] Build AppModal.tsx (wrapper for bottom sheet modals)
[ ] Build AppToast.tsx (for error/success messages)

[ ] Create a DevScreen.tsx that renders all components for visual QA
[ ] Run on device and verify visual correctness
```

---

## Phase 2: Navigation Skeleton

**Goal**: All screens are reachable and the drawer works.

```
[ ] Install @react-navigation/* packages and peer deps
[ ] Create AppNavigator.tsx with DrawerNavigator
[ ] Create HomeStack.tsx with StackNavigator
[ ] Create placeholder screens:
    - HomeScreen.tsx (empty, shows "Home")
    - TimersScreen.tsx (empty, shows "Timers")
    - SettingsScreen.tsx (empty, shows "Settings")
[ ] Create placeholder modals:
    - AddMeetingModal.tsx
    - EditMeetingModal.tsx
    - ImportCalendarModal.tsx
[ ] Connect CustomDrawerContent with labels and icons
[ ] Verify: Can navigate to all screens, drawer opens/closes
```

---

## Phase 3: Database Layer

**Goal**: WatermelonDB and MMKV are initialized and models defined.

```
[ ] Install WatermelonDB and configure SQLiteAdapter
[ ] Create src/db/schema.ts (from 04_DATABASE_SCHEMA.md)
[ ] Create src/db/models/Meeting.ts
[ ] Create src/db/models/Alarm.ts
[ ] Create src/db/database.ts (database singleton)
[ ] Install react-native-mmkv and verify it links correctly

[ ] Create src/store/useSettingsStore.ts (from 10_STATE_MANAGEMENT.md)
[ ] Create src/store/useAppStore.ts
[ ] Create src/utils/formatDuration.ts (from 11_SETTINGS.md)
[ ] Create src/utils/colorAssigner.ts

[ ] Write unit tests:
    - Test formatDuration() with 30, 60, 90, 120, 1 minute inputs
    - Test colorAssigner cycles at index 8
    - Test settings store reads/writes to MMKV
```

---

## Phase 4: Home Screen & Meeting CRUD (No Alarms Yet)

**Goal**: User can add, view, edit, and delete meetings. No alarms scheduled yet.

```
[ ] Build MeetingCard.tsx with color-coded border/background
[ ] Build MeetingList.tsx using withObservables from WatermelonDB
[ ] Build AlarmOffsetSelector.tsx (checkbox list from presets)

[ ] Implement AddMeetingModal.tsx:
    - Name, description, start/end date-time pickers
    - AlarmOffsetSelector
    - Validation (required fields, start < end, at least one offset)
    - On submit: write Meeting + Alarm records to WatermelonDB (no native alarm yet)

[ ] Implement EditMeetingModal.tsx:
    - Pre-populate from meetingId param
    - On submit: update records

[ ] Implement delete on HomeScreen:
    - Confirmation dialog
    - Delete Alarm records, then Meeting record

[ ] HomeScreen empty state illustration + message

[ ] Verify: Full CRUD cycle works without alarm scheduling
[ ] Write tests: Meeting creation, Meeting deletion (cascade alarms), validation
```

---

## Phase 5: Native Alarm Module

**Goal**: Alarms fire on the device using AlarmManager.

```
[ ] Create AlarmModule.kt:
    - scheduleAlarm() method
    - cancelAlarm() method
    - canScheduleExactAlarms() method
    - openExactAlarmSettings() method
    - canUseFullScreenIntent() method
    - openFullScreenIntentSettings() method

[ ] Create AlarmPackage.kt and register in MainApplication.kt

[ ] Create AlarmBroadcastReceiver.kt

[ ] Create AlarmActivity.kt with layout (activity_alarm.xml):
    - Current time TextView
    - Date TextView
    - Meeting title TextView
    - Meeting description TextView
    - Snooze buttons (+1, +5, +10 min)
    - STOP button

[ ] Create AlarmAudioManager.kt:
    - STREAM_ALARM MediaPlayer
    - Vibrator setup
    - play() / stop() / release()

[ ] Add all entries to AndroidManifest.xml (from 12_PERMISSIONS.md)

[ ] Create src/modules/AlarmModule.ts (TypeScript bridge)

[ ] Update AlarmService.ts to call AlarmModule.scheduleAlarm()

[ ] Test on physical device:
    - Schedule alarm 2 minutes in future
    - Lock device screen
    - Verify alarm fires, overlay appears, audio plays on alarm volume
    - Test snooze buttons
    - Test STOP button
```

---

## Phase 6: Permissions Flow

**Goal**: App correctly requests and handles all permission states.

```
[ ] Create PermissionService.ts (from 12_PERMISSIONS.md)

[ ] Build permission request UI:
    - First-launch permission sequence screens
    - Custom dialogs for SCHEDULE_EXACT_ALARM and USE_FULL_SCREEN_INTENT

[ ] Add permission guard to AlarmService.scheduleMeeting()

[ ] Add graceful degradation banner on HomeScreen if permissions missing

[ ] Test permission denial flows:
    - Deny POST_NOTIFICATIONS → notifications disabled, alarm still works
    - Deny SCHEDULE_EXACT_ALARM → hard block with settings redirect
    - Deny USE_FULL_SCREEN_INTENT → soft fallback to heads-up notification
```

---

## Phase 7: Notifications

**Goal**: Pre-alarm notifications fire and "Cancel Alarm" works.

```
[ ] Install and configure Notifee
[ ] Create NotificationService.ts (from 09_NOTIFICATIONS.md)
[ ] Call createChannels() at app startup in App.tsx
[ ] Register notifee.onBackgroundEvent() in index.js
[ ] Register notifee.onForegroundEvent() in App.tsx

[ ] Update AlarmService.scheduleMeeting() to schedule Notifee trigger notification
[ ] Update AlarmService.cancelMeetingAlarms() to cancel Notifee notifications

[ ] Test: Schedule alarm with notification enabled
    - Verify notification fires N minutes before alarm
    - Tap "Cancel Alarm" action
    - Verify alarm is cancelled (does not fire)
    - Verify WatermelonDB alarm.isDismissed = true
```

---

## Phase 8: Timers Screen

**Goal**: Timers screen shows all upcoming alarms, color-coded, with dismiss/re-enable.

```
[ ] Build TimerCard.tsx:
    - Time display (large), date, meeting info, offset label
    - Color-coded border/background
    - Dismiss button
    - Dismissed state (gray, Re-enable button)

[ ] Implement TimersScreen.tsx:
    - withObservables query for non-past alarms
    - Dismiss action: AlarmModule.cancelAlarm() + WatermelonDB update
    - Re-enable action: AlarmModule.scheduleAlarm() + WatermelonDB update (only if triggerTime is future)

[ ] Test: Add multiple meetings, verify color grouping, test dismiss and re-enable
```

---

## Phase 9: Google Calendar Integration

**Goal**: User can sign in to GCal, import events, and new meetings are written back.

```
[ ] Configure @react-native-google-signin/google-signin
[ ] Create CalendarService.ts (from 08_GOOGLE_CALENDAR.md)

[ ] Settings screen: Google Calendar section
    - Sign In button
    - Signed-in state with account email and Sign Out button

[ ] Implement ImportCalendarModal.tsx:
    - Fetch and display GCal events
    - Loading spinner
    - Error banner for sync failure
    - Expand/collapse for alarm offset selection
    - Already-imported event badge (✓)
    - Add button per expanded event

[ ] Update AlarmService.scheduleMeeting() to call CalendarService.createEvent() if signed in

[ ] Implement fail-safe:
    - calendarSyncError Zustand state
    - Alert banner on HomeScreen
    - Immediate notification if app is backgrounded

[ ] Test:
    - Sign in flow
    - Import 3 events with different offsets
    - Verify meetings appear on home screen with correct alarms
    - Expire token manually → verify fail-safe fires
```

---

## Phase 10: Settings Screen (Full)

**Goal**: All settings work and persist correctly.

```
[ ] Build full SettingsScreen.tsx with all 5 sections (from 11_SETTINGS.md)

[ ] Alarm Presets section:
    - Render presets from useSettingsStore
    - Add preset (validate, check duplicates)
    - Delete preset (with minimum 1 guard)
    - Toggle notification for preset

[ ] Notification Offset section:
    - Numeric input, validate 1–60

[ ] Alarm Audio section:
    - DocumentPicker for sound file
    - RNFS file copy to app documents
    - Volume slider + test
    - Vibration slider + test

[ ] Create SettingsModule.kt (native bridge for writing settings to SharedPreferences)
    - setAlarmSoundPath(path)
    - setAlarmVolume(volume)
    - setVibrationIntensity(intensity)
    - testAlarmSound()
    - testVibration()

[ ] Cleanup section: retention hours input

[ ] Test all settings persist across app restarts
```

---

## Phase 11: Boot Recovery & Background Cleanup

**Goal**: Alarms survive device reboots; expired meetings are auto-removed.

```
[ ] Create BootReceiver.kt and register in AndroidManifest
[ ] Create RescheduleAlarmsService.kt (foreground service)
[ ] Register DeviceEventEmitter listener for RESCHEDULE_ALARMS in index.js

[ ] Create CleanupService.ts (from 14_BACKGROUND_TASKS.md)
[ ] Add AppState foreground listener in App.tsx for immediate cleanup

[ ] Create CleanupWorker.kt (WorkManager)
[ ] Schedule CleanupWorker in MainApplication.onCreate()
[ ] Register CLEANUP_EXPIRED broadcast listener in index.js

[ ] Test:
    - Add a meeting with an alarm 5 min in future
    - Force-kill app
    - Reboot device (or use ADB: adb reboot)
    - Verify alarm fires after reboot
    - Add a meeting with end_time in the past → verify it is removed
```

---

## Phase 12: Polish & QA

**Goal**: Pixel-perfect UI, edge cases handled, ready for production.

```
[ ] Empty states for all screens (HomeScreen, TimersScreen)
[ ] All error states handled (network errors, permission denials)
[ ] Dark mode consistent throughout
[ ] AlarmActivity visual design matches React Native app theme
[ ] Confirm no zombie alarms possible (audit delete flows)
[ ] All-day GCal events filtered out correctly
[ ] Test on multiple Android versions (API 26, 30, 33, 34)
[ ] Test on Samsung (strictest battery management) and Pixel devices

[ ] Write E2E tests (Detox):
    - Add meeting → alarm fires → dismiss alarm
    - Import from GCal → alarm fires
    - Delete meeting → alarm does not fire

[ ] Performance: FlatList with 100 meetings (no lag)
[ ] Accessibility: All buttons have accessibilityLabel
```

---

## Phase 13: App Store Preparation

```
[ ] App icon (1024×1024) — design and add to android/app/src/main/res/mipmap-*/
[ ] Splash screen
[ ] ProGuard rules for WatermelonDB and Notifee
[ ] keystore file for release signing (store outside of git)
[ ] Play Store listing:
    - Screenshots (5 minimum)
    - Feature graphic
    - Data Safety form (declare USE_FULL_SCREEN_INTENT usage)
[ ] Build release APK: ./gradlew assembleRelease
[ ] Test release build on physical device
```

---

## Dependency & Risk Summary

| Risk | Mitigation |
|------|-----------|
| Android 14 denies `USE_FULL_SCREEN_INTENT` at app review | Ensure the app clearly presents itself as an alarm clock in the Play Store listing |
| WatermelonDB migration fails during development | Use `migrationEvents: true`, keep schema version incremented |
| GCal OAuth token expires silently | Wrap all API calls in try/catch, implement fail-safe notification |
| Alarm audio plays on media volume | Test with media volume at 0 and alarm volume at full on every audio code change |
| Zombie alarms after force-close | Always cancel via `AlarmModule.cancelAlarm()` before any DB delete |
| Boot recovery fails on some OEMs | Test on Samsung; Samsung requires enabling "Auto-start" in device settings |
