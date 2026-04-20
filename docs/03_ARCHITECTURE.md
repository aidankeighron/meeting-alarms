# 03 — Architecture

## Architectural Philosophy

The app follows a **layered architecture** with a clear separation of concerns:

```
┌─────────────────────────────────────────────────┐
│                  UI Layer                        │
│   (React Native components, screens, modals)    │
├─────────────────────────────────────────────────┤
│               State Layer                        │
│         (Zustand stores, derived state)          │
├─────────────────────────────────────────────────┤
│               Service Layer                      │
│   (AlarmService, CalendarService, SettingsService│
│    NotificationService, CleanupService)          │
├─────────────────────────────────────────────────┤
│             Persistence Layer                    │
│      (WatermelonDB models, MMKV settings)        │
├─────────────────────────────────────────────────┤
│       Native / Android System Layer              │
│   (Kotlin modules: AlarmManager, MediaPlayer,   │
│    BroadcastReceiver, AlarmActivity)             │
└─────────────────────────────────────────────────┘
```

Data flows **downward** (UI triggers services, services write to persistence, services call native modules). Reactive updates flow **upward** (WatermelonDB observers notify Zustand → components re-render).

---

## Project Folder Structure

```
meeting-alarms/
├── android/
│   └── app/
│       └── src/main/
│           ├── AndroidManifest.xml
│           └── java/com/meetingalarms/
│               ├── MainActivity.kt
│               ├── MainApplication.kt
│               ├── alarm/
│               │   ├── AlarmActivity.kt          ← Full-screen overlay
│               │   ├── AlarmBroadcastReceiver.kt ← Fired by AlarmManager
│               │   ├── AlarmModule.kt            ← RN Native Module (JS bridge)
│               │   └── AlarmPackage.kt           ← Registers the module
│               └── audio/
│                   └── AlarmAudioManager.kt      ← MediaPlayer + STREAM_ALARM
├── src/
│   ├── components/
│   │   ├── common/
│   │   │   ├── AppButton.tsx
│   │   │   ├── AppModal.tsx
│   │   │   └── AppToast.tsx
│   │   ├── meetings/
│   │   │   ├── MeetingCard.tsx
│   │   │   ├── MeetingList.tsx
│   │   │   └── AlarmOffsetSelector.tsx
│   │   └── timers/
│   │       └── TimerCard.tsx
│   ├── db/
│   │   ├── database.ts                   ← WatermelonDB instance
│   │   ├── schema.ts                     ← Table definitions
│   │   └── models/
│   │       ├── Meeting.ts
│   │       └── Alarm.ts
│   ├── modules/
│   │   └── AlarmModule.ts                ← TS wrapper around native module
│   ├── navigation/
│   │   ├── AppNavigator.tsx              ← Root drawer navigator
│   │   └── HomeStack.tsx                 ← Stack navigator for home + modals
│   ├── screens/
│   │   ├── HomeScreen.tsx
│   │   ├── TimersScreen.tsx
│   │   ├── SettingsScreen.tsx
│   │   └── modals/
│   │       ├── AddMeetingModal.tsx
│   │       ├── EditMeetingModal.tsx
│   │       └── ImportCalendarModal.tsx
│   ├── services/
│   │   ├── AlarmService.ts               ← Schedules / cancels alarms
│   │   ├── CalendarService.ts            ← GCal fetch + write
│   │   ├── CleanupService.ts             ← Removes past events
│   │   └── NotificationService.ts        ← Notifee wrappers
│   ├── store/
│   │   ├── useAppStore.ts                ← Zustand global store
│   │   └── useSettingsStore.ts           ← Settings state + MMKV sync
│   ├── theme/
│   │   ├── colors.ts                     ← Palette + meeting colors
│   │   ├── typography.ts                 ← Font sizes, weights
│   │   └── spacing.ts                    ← Spacing constants
│   ├── utils/
│   │   ├── formatDuration.ts             ← Min → "1 hour 30 minutes"
│   │   ├── formatDateTime.ts             ← date-fns helpers
│   │   └── colorAssigner.ts             ← Assigns meeting color by index
│   └── App.tsx                           ← Root component
├── docs/                                 ← This documentation
├── .env.example                          ← GCal client ID template
├── package.json
└── tsconfig.json
```

---

## Data Flow — Adding a Meeting

```
User taps "Add"
     │
     ▼
AddMeetingModal (UI)
     │  collects: title, description, startTime, endTime, selectedOffsets[]
     ▼
AlarmService.scheduleMeeting(meetingData)
     │
     ├─► WatermelonDB.write()
     │       creates Meeting record
     │       creates Alarm record per selected offset
     │
     ├─► AlarmModule.scheduleAlarm(alarmId, triggerTime, meetingTitle)
     │       (calls Kotlin AlarmManager.setExactAndAllowWhileIdle)
     │
     ├─► NotificationService.scheduleNotification(alarmId, notifTime, ...)
     │       (calls Notifee trigger notification)
     │
     └─► CalendarService.createEvent(meetingData)   [if signed in]
              (calls Google Calendar API)
```

---

## Data Flow — Alarm Fires

```
AlarmManager fires PendingIntent
     │
     ▼
AlarmBroadcastReceiver.onReceive()
     │  reads alarm metadata from Intent extras
     ▼
Launches AlarmActivity (full-screen)
     │
     ├─► AlarmAudioManager.play(soundFilePath)   [STREAM_ALARM]
     ├─► Vibrator.vibrate(pattern)
     └─► Displays: current time, meeting title, description
                   buttons: [+1 min] [+5 min] [+10 min] [STOP]

User taps [+5 min]
     │
     ▼
AlarmActivity reschedules alarm → AlarmManager.setExactAndAllowWhileIdle(+5 min)
     │
     ▼
AlarmActivity.finish()

User taps [STOP]
     │
     ▼
AlarmAudioManager.stop()
Vibrator.cancel()
AlarmActivity.finish()
```

---

## Data Flow — Notification Offset

```
Alarm scheduled for 1:30 PM, notification offset = 5 min
     │
     ▼
NotificationService schedules Notifee trigger for 1:25 PM
     │
At 1:25 PM:
     │
     ▼
Notifee fires standard notification: "Meeting in 5 minutes: [Title]"
     │  notification action: "Cancel Alarm"
     │
User taps "Cancel Alarm"
     │
     ▼
AlarmModule.cancelAlarm(alarmId)
     │  cancels PendingIntent in AlarmManager
     ▼
Zustand store marks alarm as dismissed
WatermelonDB updates Alarm.isDismissed = true
```

---

## Key Architectural Decisions

### Decision 1: Kotlin `AlarmActivity` vs. React Native Full-Screen Modal

A full-screen React Native modal **cannot** reliably appear over the lock screen. Android requires a native `Activity` with specific window flags set in `onCreate`. The `AlarmActivity` is a separate Kotlin `Activity` that is entirely independent of the React Native bridge — it works even if React Native is not loaded. This is the same pattern used by all alarm clock apps.

### Decision 2: WatermelonDB + MMKV (split persistence)

- WatermelonDB for relational data that needs querying, sorting, and reactive updates
- MMKV for simple key-value settings that need to be read synchronously at startup

Using WatermelonDB for settings would require async queries; using MMKV for meetings would require manual relationship management.

### Decision 3: Zustand (not Redux)

Redux adds significant boilerplate for a single-user app. Zustand achieves the same global state sharing with ~5 lines of code per store. Since WatermelonDB already handles persistence and reactivity for domain data, Zustand only needs to hold transient UI state (e.g., "is the import modal open?", "current GCal token status").
