# 14 — Background Tasks & Cleanup

## Overview

Two background concerns must be handled carefully on Android:
1. **BootReceiver**: Re-schedule alarms after the device reboots (AlarmManager is cleared on reboot)
2. **CleanupService**: Remove expired meetings/alarms from the database automatically

Both face the same fundamental problem: JavaScript-side timers (`setTimeout`, `setInterval`) die when the app is killed or the device reboots. The solution is WorkManager via `react-native-background-actions`.

---

## 1. The Zombie Alarm Problem

When a user **does not kill the app** and React Native is running, you can manage cleanup with in-memory timers. But if the app is force-closed, all JS-side logic dies.

Worse: alarms registered with `AlarmManager` **survive** app death (they are system-level). This means:
- A meeting can be deleted → WatermelonDB record gone
- But the `AlarmManager` `PendingIntent` still exists
- The alarm fires → `BroadcastReceiver` launches `AlarmActivity` with gone/stale data

**Solution**: Always call `AlarmModule.cancelAlarm(alarmId)` **before** deleting any alarm record from WatermelonDB.

---

## 2. Boot Recovery

### BootReceiver.kt

Already defined in `07_ALARM_SYSTEM.md`. It starts a `RescheduleAlarmsService` (a foreground Service) on boot.

### RescheduleAlarmsService.kt

```kotlin
package com.meetingalarms.alarm

import android.app.Service
import android.content.Intent
import android.os.IBinder

class RescheduleAlarmsService : Service() {

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        // Start as foreground service to avoid being killed immediately
        startForeground(NOTIF_ID, buildForegroundNotification())

        // Broadcast an event to the React Native JS runtime to re-schedule
        // The JS side handles DB queries and calls AlarmModule.scheduleAlarm() for each
        val localIntent = Intent("com.meetingalarms.RESCHEDULE_ALARMS")
        sendBroadcast(localIntent)

        stopSelf()
        return START_NOT_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun buildForegroundNotification() = /* build a silent notification */ TODO()

    companion object {
        const val NOTIF_ID = 9999
    }
}
```

### React Native Side — Listening for Reschedule

In the app entry point (`index.js`), register a DeviceEventEmitter listener:

```typescript
import { DeviceEventEmitter } from 'react-native';
import AlarmService from './src/services/AlarmService';
import { database } from './src/db/database';
import Alarm from './src/db/models/Alarm';
import { Q } from '@nozbe/watermelondb';

DeviceEventEmitter.addListener('RESCHEDULE_ALARMS', async () => {
  const now = Date.now();
  const futureAlarms = await database
    .get<Alarm>('alarms')
    .query(
      Q.where('trigger_time', Q.gt(now)),
      Q.where('is_dismissed', false),
    )
    .fetch();

  for (const alarm of futureAlarms) {
    const meeting = await alarm.meeting.fetch();
    await AlarmModule.scheduleAlarm(
      alarm.androidAlarmId,
      alarm.triggerTime,
      meeting.title,
      meeting.description,
    );
  }
});
```

---

## 3. Scheduled Cleanup (WorkManager)

### Configuration

Use `react-native-background-actions` or, alternatively, write a direct WorkManager task in Kotlin with an RN bridge.

The cleanup task should run once every hour. WorkManager persists across reboots and app restarts.

### CleanupService.ts

```typescript
import { database } from '../db/database';
import Meeting from '../db/models/Meeting';
import Alarm from '../db/models/Alarm';
import { Q } from '@nozbe/watermelondb';
import AlarmModule from '../modules/AlarmModule';
import { getSettings } from '../store/useSettingsStore';

async function removeExpiredMeetings(): Promise<void> {
  const { retentionHours } = getSettings();
  const cutoffTime = Date.now() - retentionHours * 60 * 60 * 1000;

  const expiredMeetings = await database
    .get<Meeting>('meetings')
    .query(Q.where('end_time', Q.lt(cutoffTime)))
    .fetch();

  for (const meeting of expiredMeetings) {
    const alarms = await meeting.alarms.fetch();

    // Cancel all alarms in AlarmManager first (prevent zombie alarms)
    for (const alarm of alarms) {
      await AlarmModule.cancelAlarm(alarm.androidAlarmId);
    }

    // Delete from database
    await database.write(async () => {
      await Promise.all(alarms.map(a => a.destroyPermanently()));
      await meeting.destroyPermanently();
    });
  }
}

const CleanupService = { removeExpiredMeetings };
export default CleanupService;
```

### When to Call Cleanup

- **On app foreground**: Call `CleanupService.removeExpiredMeetings()` in `AppState` change listener.
- **WorkManager task**: Schedule a periodic task every 60 minutes.

```typescript
// In App.tsx
import { AppState } from 'react-native';
import CleanupService from './src/services/CleanupService';

useEffect(() => {
  const subscription = AppState.addEventListener('change', (nextState) => {
    if (nextState === 'active') {
      CleanupService.removeExpiredMeetings();
    }
  });

  return () => subscription.remove();
}, []);
```

---

## 4. WorkManager Periodic Task (Kotlin)

For true background cleanup when the app is force-closed:

```kotlin
// CleanupWorker.kt
package com.meetingalarms.background

import android.content.Context
import androidx.work.Worker
import androidx.work.WorkerParameters
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import java.util.concurrent.TimeUnit

class CleanupWorker(context: Context, params: WorkerParameters) : Worker(context, params) {

    override fun doWork(): Result {
        // Send a broadcast that React Native can listen to for cleanup
        val intent = android.content.Intent("com.meetingalarms.CLEANUP_EXPIRED")
        applicationContext.sendBroadcast(intent)
        return Result.success()
    }
}

// Schedule in MainApplication.kt:
fun scheduleCleanupWorker(context: Context) {
    val request = PeriodicWorkRequestBuilder<CleanupWorker>(1, TimeUnit.HOURS)
        .build()
    WorkManager.getInstance(context).enqueueUniquePeriodicWork(
        "CleanupWorker",
        androidx.work.ExistingPeriodicWorkPolicy.KEEP,
        request
    )
}
```

Call `scheduleCleanupWorker(this)` in `MainApplication.onCreate()`.

---

## 5. Cleanup Logic Summary

| Trigger | Method | Handles |
|---------|--------|---------|
| App comes to foreground | `AppState` listener | Immediate cleanup when user opens app |
| WorkManager (hourly) | `CleanupWorker` | Cleanup while app is backgrounded/killed |
| Device reboot | `BootReceiver` | Re-schedule AlarmManager intents |
| Meeting deleted by user | `AlarmService.cancelMeetingAlarms()` | Manual removal |
| Alarm dismissed by user | `AlarmModule.cancelAlarm()` | Individual alarm cancellation |

---

## 6. Notification Cleanup

Notifee trigger notifications also need to be cancelled when a meeting is deleted:

```typescript
import notifee from '@notifee/react-native';

async function cancelMeetingNotifications(meeting: Meeting): Promise<void> {
  const alarms = await meeting.alarms.fetch();

  for (const alarm of alarms) {
    await notifee.cancelTriggerNotification(`notif_${alarm.androidAlarmId}`);
  }
}
```

Add this to `AlarmService.cancelMeetingAlarms()` before deleting database records.
