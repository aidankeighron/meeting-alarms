# 01 — Project Overview

## Product Vision

**Meeting Alarm Manager** is a personal Android productivity app that solves a simple but frustrating problem: being caught off-guard by meetings. The app lets the user manually enter meetings or import them directly from Google Calendar, and then schedules Android system alarms that fire exactly like the built-in clock app — waking the device from sleep, bypassing the lock screen, and playing audio on the alarm volume channel.

The app is **Android-only**, **single-user**, and **locally-first**. No backend server is needed; all data lives on-device using WatermelonDB. Google Calendar is used as a read/write integration, not as a storage layer.

---

## Problem Statement

1. The user frequently forgets upcoming meetings because relying on Google Calendar push notifications alone is insufficient — they are easy to miss and can be silenced.
2. Standard notification reminders do not wake the device or override the lock screen.
3. There is no single place to see all upcoming alarms and dismiss ones that are no longer needed.

---

## Core Goals

- **Alarm reliability:** Alarms must fire regardless of media volume, using `STREAM_ALARM`.
- **Lock screen bypass:** The alarm overlay must appear over the lock screen, exactly like the system clock.
- **Google Calendar sync:** Import events without re-entering them manually; sync new manually-entered events back to GCal.
- **Per-meeting alarm configurability:** Each meeting can have different alarm offsets (10 min, 30 min, 1 hr, etc.) selected at creation time.
- **Settings-driven defaults:** All defaults (alarm offsets, notification offsets, retention policy, alarm sound) are configurable and persisted.

---

## Out of Scope (v1)

- iOS support
- Multi-user / team calendars
- Cloud backup of meeting data
- Widget or watch integration
- Recurring meeting series management

---

## User Stories

### Meetings

| ID | Story |
|----|-------|
| M-01 | As a user, I can add a new meeting with a name, description, start time, and end time. |
| M-02 | As a user, I can select which alarm offsets apply to a specific meeting at the time of creation (e.g., 10 min before, 30 min before). |
| M-03 | As a user, I can edit any field of an existing meeting, which reschedules all associated alarms. |
| M-04 | As a user, I can delete a meeting, which also cancels all associated alarms. |
| M-05 | As a user, I see all upcoming meetings sorted chronologically on the home screen. |

### Google Calendar Import

| ID | Story |
|----|-------|
| G-01 | As a user, I can sign into my Google account to link my Google Calendar. |
| G-02 | As a user, I can open an import modal that shows my upcoming GCal events sorted by time. |
| G-03 | As a user, I can expand any GCal event in the import modal to pick alarm offsets, then add it in one tap. |
| G-04 | As a user, I can import multiple events in a single modal session without closing it. |
| G-05 | As a user, I receive an in-app alert if the GCal sync fails (token expired, no network). |
| G-06 | As a user, newly added manual meetings are also written to my Google Calendar. |

### Alarm System

| ID | Story |
|----|-------|
| A-01 | As a user, when an alarm fires, a full-screen overlay appears over the lock screen with the current time, meeting title, and description. |
| A-02 | As a user, I can snooze the alarm by 1, 5, or 10 minutes from the overlay. |
| A-03 | As a user, I can dismiss the alarm from the overlay with a prominent stop button. |
| A-04 | As a user, the alarm plays audio using the system alarm volume, not media volume. |
| A-05 | As a user, the alarm vibrates the device when it fires. |
| A-06 | As a user, I can set a custom alarm sound by picking a local `.mp3` or `.wav` file. |
| A-07 | As a user, I can set a custom volume level and vibration intensity in settings, with test buttons. |

### Notifications

| ID | Story |
|----|-------|
| N-01 | As a user, I receive a standard notification N minutes before each alarm (notification offset). |
| N-02 | As a user, the notification can be tapped to cancel the upcoming alarm. |
| N-03 | As a user, I can configure which alarm offsets also trigger a notification in settings. |
| N-04 | As a user, I can set a notification offset (e.g., "notify 5 minutes before the alarm"). |

### Timers Page

| ID | Story |
|----|-------|
| T-01 | As a user, I can view all upcoming alarms sorted chronologically, color-coded by meeting. |
| T-02 | As a user, I can dismiss an individual alarm (grays it out but does not delete it). |
| T-03 | As a user, I can re-enable a dismissed alarm. |
| T-04 | As a user, past events and their alarms are automatically removed 1 hour after the event's end time (configurable). |

### Settings

| ID | Story |
|----|-------|
| S-01 | As a user, I can manage alarm offset presets (add, delete). |
| S-02 | As a user, I can toggle whether each offset also sends a notification. |
| S-03 | As a user, I can set the notification offset (e.g., 5 minutes before the alarm fires). |
| S-04 | As a user, I can set the retention policy (how long after an event ends before it is removed). |
| S-05 | As a user, I can sign in/sign out of Google Calendar. |
| S-06 | As a user, I can choose my alarm sound from my local file system. |
| S-07 | As a user, I can adjust the app-internal alarm volume and vibration intensity and test them. |

---

## Constraints & Non-Functional Requirements

- **Target API:** Android 14 (API 34). Must gracefully handle restricted permissions.
- **Min SDK:** Android 8.0 (API 26) — minimum required for `AudioAttributes.USAGE_ALARM`.
- **Language:** TypeScript (React Native), Kotlin (native modules).
- **No backend:** No server, no Firebase, no cloud database.
- **Offline-first:** The app must be fully functional without internet access; GCal sync is an optional enhancement.
- **Performance:** Home screen list and timers list must render without lag for up to 500 meetings.
