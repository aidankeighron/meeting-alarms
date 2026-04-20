# Meeting Alarm Manager — Documentation Index

This documentation suite provides everything an AI agent needs to build the **Meeting Alarm Manager** Android application from scratch. Read documents in order; each builds on the previous.

---

## Document Map

| # | File | Purpose |
|---|------|---------|
| 01 | [`01_PROJECT_OVERVIEW.md`](./01_PROJECT_OVERVIEW.md) | Product vision, goals, user stories, and scope |
| 02 | [`02_TECH_STACK.md`](./02_TECH_STACK.md) | Complete library list with justifications and versions |
| 03 | [`03_ARCHITECTURE.md`](./03_ARCHITECTURE.md) | App architecture, folder structure, layer diagram |
| 04 | [`04_DATABASE_SCHEMA.md`](./04_DATABASE_SCHEMA.md) | WatermelonDB schema, models, and associations |
| 05 | [`05_NAVIGATION.md`](./05_NAVIGATION.md) | Screen map, React Navigation setup, drawer config |
| 06 | [`06_SCREENS.md`](./06_SCREENS.md) | Full spec for every screen and modal |
| 07 | [`07_ALARM_SYSTEM.md`](./07_ALARM_SYSTEM.md) | Native alarm module, Android system interaction |
| 08 | [`08_GOOGLE_CALENDAR.md`](./08_GOOGLE_CALENDAR.md) | OAuth2 flow, API calls, import logic, fail-safe |
| 09 | [`09_NOTIFICATIONS.md`](./09_NOTIFICATIONS.md) | Notifee setup, channels, offset logic |
| 10 | [`10_STATE_MANAGEMENT.md`](./10_STATE_MANAGEMENT.md) | Zustand stores, MMKV settings, data flow |
| 11 | [`11_SETTINGS.md`](./11_SETTINGS.md) | Full settings page spec and persistence strategy |
| 12 | [`12_PERMISSIONS.md`](./12_PERMISSIONS.md) | Android 14 permission model, runtime request flows |
| 13 | [`13_DESIGN_SYSTEM.md`](./13_DESIGN_SYSTEM.md) | Color palette, typography, component library spec |
| 14 | [`14_BACKGROUND_TASKS.md`](./14_BACKGROUND_TASKS.md) | WorkManager cleanup, zombie alarm prevention |
| 15 | [`15_IMPLEMENTATION_PLAN.md`](./15_IMPLEMENTATION_PLAN.md) | Phased step-by-step build order |

---

## Quick-Reference Glossary

| Term | Meaning |
|------|---------|
| **Meeting** | A user-created or GCal-imported calendar event |
| **Alarm** | A full-screen, lock-screen-bypassing Android alarm tied to a meeting |
| **Notification** | A standard push notification (non-waking) that precedes an alarm |
| **Alarm Offset** | Minutes before a meeting the alarm fires (e.g., 10 min before) |
| **Notification Offset** | Minutes before the alarm fires that the notification arrives |
| **Retention Policy** | How long after an event ends before it is deleted from the app |
| **Trigger Time** | The exact Unix epoch millisecond the alarm fires |
| **Zombie Alarm** | A `PendingIntent` that remains in `AlarmManager` after its parent meeting was deleted |

---

> **For AI Agents:** Start at `01_PROJECT_OVERVIEW.md` and work through the documents sequentially. The implementation plan in `15_IMPLEMENTATION_PLAN.md` ties everything together into concrete ordered steps.
