# 06 — Screens & Modals

This document is the precise UI specification for every screen. An agent building the UI should treat this as the single source of truth for layout, components, and behavior.

---

## Screen 1: HomeScreen

**Route:** `Home` (root of HomeStack)

### Layout

```
┌─────────────────────────────────┐
│ ☰  Meetings          [📅 Import]│  ← Header
├─────────────────────────────────┤
│                                  │
│  ┌───────────────────────────┐  │
│  │ MeetingCard (color tinted) │  │
│  │  Title                     │  │
│  │  Mon Apr 21 · 10:00 AM    │  │
│  │  3 alarms scheduled        │  │
│  │              [✎] [🗑]     │  │
│  └───────────────────────────┘  │
│                                  │
│  ┌───────────────────────────┐  │
│  │ MeetingCard               │  │
│  └───────────────────────────┘  │
│                                  │
│                        [+]       │  ← FAB bottom-right
└─────────────────────────────────┘
```

### Components

- **`MeetingList`**: flatlist of `MeetingCard` components, sorted by `start_time` ascending. Uses WatermelonDB `withObservables` to reactively re-render when meetings change.
- **`MeetingCard`**: Displays meeting title, formatted start date/time, number of alarms. Left border and background tinted with the meeting's assigned pastel color. Has edit (pencil) and delete (trash) icon buttons on the right side.
- **FAB (Floating Action Button)**: Circular `+` button anchored to bottom-right. Navigates to `AddMeeting` modal.
- **Import button**: Calendar icon in the header right area. Navigates to `ImportCalendar` modal.

### Behavior

- Empty state: Display a centered illustration and message: "No meetings yet. Tap + to add one."
- On delete tap: Show a confirmation `Alert.alert()` before deleting. Deleting calls `AlarmService.cancelMeetingAlarms(meeting)` then deletes from WatermelonDB.
- On edit tap: Navigate to `EditMeeting` with `{ meetingId: meeting.id }`.
- Meetings whose `end_time` is in the past are shown in a slightly more muted style (reduced opacity) until the `CleanupService` removes them.

---

## Screen 2: TimersScreen

**Route:** `Timers` (drawer item)

### Layout

```
┌─────────────────────────────────┐
│ ☰  Timers                       │
├─────────────────────────────────┤
│                                  │
│  ┌───────────────────────────┐  │
│  │ 10:00 AM   [Meeting Title] │  │ ← color-coded left border
│  │ Mon Apr 21  10 min before  │  │
│  │             [Dismiss]       │  │
│  └───────────────────────────┘  │
│                                  │
│  ┌──────────────────────────┐   │ ← dismissed alarm (grayed)
│  │ 9:50 AM    [Meeting Title]│   │
│  │ Mon Apr 21  20 min before │   │
│  │ [DISMISSED]   [Re-enable] │   │
│  └──────────────────────────┘   │
└─────────────────────────────────┘
```

### Components

- **`TimerCard`**: Shows `trigger_time` (formatted as `h:mm a`), date below it, and meeting title + offset description (`"10 min before"`) on the right. Left border is tinted with the meeting's pastel color. Background is lightly tinted.
- **Dismiss button**: Calls `AlarmModule.cancelAlarm(alarm.androidAlarmId)` and sets `alarm.isDismissed = true` in WatermelonDB. The card turns gray and a "Re-enable" button appears.
- **Re-enable button**: Sets `alarm.isDismissed = false` and re-schedules the alarm via `AlarmService` (only if `trigger_time` is still in the future).

### Data

Sorted by `trigger_time` ascending. Past alarms (whose `trigger_time` is in the past) are NOT shown, since `CleanupService` removes them. The screen observes WatermelonDB reactively so cards disappear automatically.

### Grouping

Group alarms by meeting using the meeting's `color_index`. All alarms for the same meeting share the same pastel color, making it visually obvious which alarms belong together.

---

## Screen 3: SettingsScreen

**Route:** `Settings` (drawer item)

This screen is specified in detail in [`11_SETTINGS.md`](./11_SETTINGS.md). For layout purposes:

- Scrollable list of setting sections
- Each section has a header label
- Settings sections: **Google Calendar**, **Alarm Presets**, **Notifications**, **Alarm Audio**, **Cleanup**

---

## Modal 1: AddMeetingModal

**Route:** `AddMeeting` (stack modal, slides up)

### Layout

```
┌─────────────────────────────────┐
│         Add Meeting              │  ← Sheet handle / title
├─────────────────────────────────┤
│ Meeting Name *                   │
│ ┌─────────────────────────────┐ │
│ │ [text input]                │ │
│ └─────────────────────────────┘ │
│                                  │
│ Description                      │
│ ┌─────────────────────────────┐ │
│ │ [multiline text input]      │ │
│ └─────────────────────────────┘ │
│                                  │
│ Start Date & Time *              │
│ ┌─────────────────────────────┐ │
│ │ Mon Apr 21, 2026  10:00 AM  │ │  ← tappable, opens date/time picker
│ └─────────────────────────────┘ │
│                                  │
│ End Date & Time *                │
│ ┌─────────────────────────────┐ │
│ │ Mon Apr 21, 2026  11:00 AM  │ │
│ └─────────────────────────────┘ │
│                                  │
│ Alarm Offsets                    │
│ ☑ 10 minutes before             │
│ ☐ 30 minutes before             │
│ ☐ 1 hour before                 │
│   [ + custom offset ]           │ ← optional: inline preset picker
│                                  │
│ ┌──────────────────────────────┐ │
│ │         Add Meeting           │ │  ← primary action button
│ └──────────────────────────────┘ │
└─────────────────────────────────┘
```

### Behavior

- Alarm offset checkboxes are **populated from `AlarmPreset[]` in MMKV** (the user's saved presets). At least one must be checked.
- Date/time pickers: Use React Native's built-in `DateTimePicker` (from `@react-native-community/datetimepicker`). Show the date picker first, then the time picker sequentially.
- Validation:
  - Title: required, max 100 chars
  - Start time: must be in the future
  - End time: must be after start time
  - At least one alarm offset checked
- On submit: calls `AlarmService.scheduleMeeting(...)`, then closes.
- On error: shows inline validation messages, does not close.

---

## Modal 2: EditMeetingModal

**Route:** `EditMeeting` with param `{ meetingId: string }`

Identical layout to AddMeetingModal, but pre-populated with the existing meeting's data. On submit, calls `AlarmService.updateMeeting(...)` which:

1. Cancels all existing alarms for this meeting
2. Deletes existing `Alarm` records
3. Creates new `Alarm` records with updated times
4. Re-schedules all new alarms via `AlarmModule`
5. Updates the GCal event if signed in

---

## Modal 3: ImportCalendarModal

**Route:** `ImportCalendar` (stack modal)

### Layout

```
┌─────────────────────────────────┐
│         Import from Calendar     │  ← title
│         [✕ Close]              │
├─────────────────────────────────┤
│                                  │
│  ┌───────────────────────────┐  │
│  │ Team Standup              │  │  ← GCal event row (collapsed)
│  │ Mon Apr 21 · 9:00 AM      │  │
│  └───────────────────────────┘  │
│                                  │
│  ┌───────────────────────────┐  │
│  │ Product Review ▾          │  │  ← expanded (user tapped it)
│  │ Mon Apr 21 · 2:00 PM      │  │
│  │ ─────────────────────────  │  │
│  │ ☑ 10 minutes before       │  │
│  │ ☐ 30 minutes before       │  │
│  │ ☐ 1 hour before           │  │
│  │              [Add]         │  │
│  └───────────────────────────┘  │
│                                  │
│  ┌───────────────────────────┐  │
│  │ Sprint Planning           │  │  ← already added (checkmark badge)
│  │ Tue Apr 22 · 10:00 AM ✓  │  │
│  └───────────────────────────┘  │
│                                  │
└─────────────────────────────────┘
```

### Behavior

- On open: calls `CalendarService.fetchUpcomingEvents()`. Shows a loading spinner while fetching. If the call fails (401, network error), shows an error banner at the top: *"Could not connect to Google Calendar. Please check your connection or re-authenticate in Settings."*
- Events already imported (matching `gcal_event_id` in WatermelonDB) show a ✓ badge and are non-interactive.
- Tapping an event row **expands** it to show the alarm offset checkboxes. Tapping again collapses it.
- The "Add" button within an expanded event calls `AlarmService.scheduleMeeting(...)` with the GCal event data, then marks the event row with ✓.
- Multiple events can be in the expanded state simultaneously, but only one "Add" processes at a time.
- Not a blocking modal — the user can dismiss it without adding anything.

---

## AlarmActivity (Native Kotlin — not a React Native screen)

This is defined in `android/app/src/main/java/com/meetingalarms/alarm/AlarmActivity.kt`.

### Visual Layout

```
┌─────────────────────────────────┐
│                                  │
│          10:05 AM                │  ← large, current system time (updates every minute)
│         Monday, April 21         │
│                                  │
│  ┌───────────────────────────┐  │
│  │ 🔔 Product Review         │  │  ← meeting title
│  │ Starting in 10 minutes     │  │  ← relative time to meeting
│  │ "Q2 roadmap discussion"    │  │  ← description (truncated to 2 lines)
│  └───────────────────────────┘  │
│                                  │
│  [+1 min]   [+5 min]  [+10 min] │  ← snooze buttons
│                                  │
│  ┌───────────────────────────┐  │
│  │         S T O P           │  │  ← large dismiss button
│  └───────────────────────────┘  │
└─────────────────────────────────┘
```

### Behavior

- Appears **over the lock screen** (uses window flags `FLAG_SHOW_WHEN_LOCKED | FLAG_TURN_SCREEN_ON`).
- Meeting metadata (title, description, triggerTime) passed via `Intent` extras from `AlarmBroadcastReceiver`.
- Audio plays immediately on `AlarmActivity.onCreate()`.
- Vibrates immediately on `AlarmActivity.onCreate()`.
- **Snooze** (`+N min`): stops audio/vibration, reschedules alarm via `AlarmManager.setExactAndAllowWhileIdle(triggerTime + N * 60_000)`, calls `finish()`.
- **Stop**: stops audio/vibration, calls `finish()`. Does **not** cancel future alarms of the same meeting — only this specific alarm instance is dismissed.
- The time display (`10:05 AM`) updates every 60 seconds using a `Handler.postDelayed` loop.
