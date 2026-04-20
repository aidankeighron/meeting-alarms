# 09 — Notifications

## Overview

The notification system uses **Notifee** for scheduling "pre-alarm" standard notifications. These are non-waking notifications that fire N minutes before the alarm to give the user an advance warning. The user can also dismiss the upcoming alarm directly from the notification.

---

## Notification vs. Alarm Distinction

| Feature | Notification | Alarm |
|---------|-------------|-------|
| Wake device | ❌ No | ✅ Yes |
| Bypass lock screen | ❌ No | ✅ Yes |
| Audio stream | `STREAM_NOTIFICATION` | `STREAM_ALARM` |
| Library | Notifee | Custom Kotlin module |
| Dismissable from notification tray | ✅ Yes | ❌ N/A |
| User can cancel alarm from it | ✅ Yes (action button) | N/A |

---

## 1. Notifee Setup

### Installation

```bash
npm install @notifee/react-native
cd android && ./gradlew clean
```

No additional native linking needed for React Native 0.70+.

### Create Notification Channels

Call this once at app startup (safe to call multiple times; Notifee is idempotent):

```typescript
// src/services/NotificationService.ts
import notifee, {
  AndroidImportance,
  AndroidVisibility,
  TriggerType,
  TimestampTrigger,
  AndroidNotificationSetting,
} from '@notifee/react-native';

async function createChannels(): Promise<void> {
  // Pre-alarm notification channel
  await notifee.createChannel({
    id: 'pre_alarm_channel',
    name: 'Meeting Reminders',
    importance: AndroidImportance.HIGH,
    visibility: AndroidVisibility.PUBLIC,
    sound: 'default',
    vibration: false,     // Notifications don't vibrate; only alarm does
  });

  // Sync failure alert channel
  await notifee.createChannel({
    id: 'sync_alert_channel',
    name: 'Calendar Sync Alerts',
    importance: AndroidImportance.HIGH,
    visibility: AndroidVisibility.PUBLIC,
  });
}
```

---

## 2. Scheduling a Pre-Alarm Notification

```typescript
async function scheduleNotification(params: {
  alarmId: number;
  triggerTime: number;    // Unix ms — adjusted for notification offset
  meetingTitle: string;
}): Promise<void> {
  const trigger: TimestampTrigger = {
    type: TriggerType.TIMESTAMP,
    timestamp: params.triggerTime,
    alarmManager: {
      allowWhileIdle: true,   // Fire even in Doze mode
    },
  };

  await notifee.createTriggerNotification(
    {
      id: `notif_${params.alarmId}`,
      title: `⏰ Upcoming Meeting`,
      body: params.meetingTitle,
      android: {
        channelId: 'pre_alarm_channel',
        importance: AndroidImportance.HIGH,
        pressAction: { id: 'default' },
        actions: [
          {
            title: 'Cancel Alarm',
            pressAction: { id: 'cancel_alarm' },
          },
        ],
        // Not a full-screen intent — this is just a heads-up notification
      },
    },
    trigger,
  );
}
```

---

## 3. Handling Notification Actions

Notifee delivers action events via a background event handler registered at the app root:

```typescript
// index.js (app entry point)
import notifee, { EventType } from '@notifee/react-native';
import AlarmModule from './src/modules/AlarmModule';
import { database } from './src/db/database';
import Alarm from './src/db/models/Alarm';
import { Q } from '@nozbe/watermelondb';

notifee.onBackgroundEvent(async ({ type, detail }) => {
  if (type === EventType.ACTION_PRESS && detail.pressAction?.id === 'cancel_alarm') {
    const notifId = detail.notification?.id;

    if (notifId) {
      const alarmId = parseInt(notifId.replace('notif_', ''), 10);

      // Cancel the AlarmManager intent
      await AlarmModule.cancelAlarm(alarmId);

      // Mark as dismissed in WatermelonDB
      const alarms = await database
        .get<Alarm>('alarms')
        .query(Q.where('android_alarm_id', alarmId))
        .fetch();

      await database.write(async () => {
        for (const alarm of alarms) {
          await alarm.update(a => { a.isDismissed = true; });
        }
      });

      // Dismiss the notification itself
      await notifee.cancelNotification(notifId);
    }
  }
});
```

Also register a foreground event handler for when the app is open:

```typescript
// Inside App.tsx useEffect
useEffect(() => {
  const unsubscribe = notifee.onForegroundEvent(({ type, detail }) => {
    if (type === EventType.ACTION_PRESS && detail.pressAction?.id === 'cancel_alarm') {
      // Same logic as background handler — can reuse a shared function
      handleCancelAlarmAction(detail);
    }
  });

  return unsubscribe;
}, []);
```

---

## 4. Cancelling a Scheduled Notification

When the user dismisses an alarm from the Timers screen (before it fires), cancel both the alarm AND the notification:

```typescript
async function cancelNotification(alarmId: number): Promise<void> {
  await notifee.cancelTriggerNotification(`notif_${alarmId}`);
}
```

---

## 5. Immediate Sync Failure Notification

```typescript
async function showSyncFailureNotification(): Promise<void> {
  await notifee.displayNotification({
    title: 'Calendar Sync Failed',
    body: 'Could not connect to Google Calendar. Tap to re-authenticate in Settings.',
    android: {
      channelId: 'sync_alert_channel',
      importance: AndroidImportance.HIGH,
      pressAction: { id: 'default' },
    },
  });
}
```

---

## 6. NotificationService Summary Interface

```typescript
const NotificationService = {
  createChannels: () => Promise<void>,
  scheduleNotification: (params: { alarmId, triggerTime, meetingTitle }) => Promise<void>,
  cancelNotification: (alarmId: number) => Promise<void>,
  showSyncFailureNotification: () => Promise<void>,
  showImmediateNotification: (params: { title, body }) => Promise<void>,
};
```

---

## 7. Notification Offset Logic

The notification offset is stored in MMKV as `notification_offset_minutes` (default: 5).

```typescript
const alarmTriggerTime = startTime - offsetMinutes * 60_000;
const notifTriggerTime = alarmTriggerTime - notificationOffsetMinutes * 60_000;
```

**Example:**
- Meeting starts at 2:00 PM
- Alarm offset = 10 minutes → alarm fires at 1:50 PM
- Notification offset = 5 minutes → notification fires at 1:45 PM

**Edge cases:**
- If `notifTriggerTime < Date.now()`, skip scheduling the notification (it's already in the past).
- If `alarmTriggerTime < Date.now()`, skip scheduling both.

---

## 8. Required Permissions

Notifee handles the `POST_NOTIFICATIONS` permission request on Android 13+. On first launch, call:

```typescript
const settings = await notifee.requestPermission();
if (settings.android.alarm === AndroidNotificationSetting.ENABLED) {
  // Good to go
}
```

This will show the system permission dialog for `POST_NOTIFICATIONS`. You still need to handle `SCHEDULE_EXACT_ALARM` separately (see `12_PERMISSIONS.md`).
