# 07 — Alarm System

## Overview

The alarm system is the most technically complex part of the application. It spans three layers:
1. **TypeScript / React Native** — scheduling logic and bridge calls
2. **Kotlin Native Module** — the JS↔Android bridge
3. **Android System** — `AlarmManager`, `BroadcastReceiver`, `AlarmActivity`, `MediaPlayer`

> **Critical:** Read `NOTES.md` in the project root before implementing. It contains essential Android 14 gotchas that will prevent silent failures.

---

## Component Map

```
AlarmService.ts (TS)
    │ calls
    ▼
AlarmModule.ts (TS wrapper)
    │ NativeModules bridge
    ▼
AlarmModule.kt (Kotlin)
    │ uses
    ├─► AlarmManager (schedules PendingIntent)
    └─► Intent extras (passes alarm metadata)

AlarmManager fires PendingIntent at triggerTime
    │
    ▼
AlarmBroadcastReceiver.kt
    │ starts
    ▼
AlarmActivity.kt (full-screen overlay)
    │ uses
    └─► AlarmAudioManager.kt (MediaPlayer on STREAM_ALARM)
```

---

## 1. Android Manifest Requirements

Add the following to `android/app/src/main/AndroidManifest.xml`:

```xml
<!-- Permissions -->
<uses-permission android:name="android.permission.USE_FULL_SCREEN_INTENT" />
<uses-permission android:name="android.permission.SCHEDULE_EXACT_ALARM" />
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
<uses-permission android:name="android.permission.VIBRATE" />
<uses-permission android:name="android.permission.WAKE_LOCK" />
<uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />

<!-- Inside <application> -->
<receiver
    android:name=".alarm.AlarmBroadcastReceiver"
    android:exported="true" />

<receiver
    android:name=".alarm.BootReceiver"
    android:exported="true">
  <intent-filter>
    <action android:name="android.intent.action.BOOT_COMPLETED" />
  </intent-filter>
</receiver>

<activity
    android:name=".alarm.AlarmActivity"
    android:exported="true"
    android:launchMode="singleInstance"
    android:showOnLockScreen="true"
    android:theme="@style/Theme.AlarmActivity" />
```

### Why `RECEIVE_BOOT_COMPLETED`?

If the device reboots, all `AlarmManager` intents are cleared. The `BootReceiver` listens for device boot and re-schedules all future alarms by reading from WatermelonDB. See [Section 5: BootReceiver](#5-bootreceiver).

---

## 2. AlarmModule.kt (Native Module Bridge)

```kotlin
// android/app/src/main/java/com/meetingalarms/alarm/AlarmModule.kt
package com.meetingalarms.alarm

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import com.facebook.react.bridge.*

class AlarmModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "AlarmModule"

    @ReactMethod
    fun scheduleAlarm(
        alarmId: Int,
        triggerTimeMs: Double,
        meetingTitle: String,
        meetingDescription: String,
        promise: Promise
    ) {
        try {
            val context = reactApplicationContext
            val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager

            val intent = Intent(context, AlarmBroadcastReceiver::class.java).apply {
                putExtra("alarm_id", alarmId)
                putExtra("meeting_title", meetingTitle)
                putExtra("meeting_description", meetingDescription)
            }

            val pendingIntent = PendingIntent.getBroadcast(
                context,
                alarmId,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )

            alarmManager.setExactAndAllowWhileIdle(
                AlarmManager.RTC_WAKEUP,
                triggerTimeMs.toLong(),
                pendingIntent
            )

            promise.resolve(true)
        }
        catch (e: Exception) {
            promise.reject("SCHEDULE_ALARM_ERROR", e.message)
        }
    }

    @ReactMethod
    fun cancelAlarm(alarmId: Int, promise: Promise) {
        try {
            val context = reactApplicationContext
            val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager

            val intent = Intent(context, AlarmBroadcastReceiver::class.java)
            val pendingIntent = PendingIntent.getBroadcast(
                context,
                alarmId,
                intent,
                PendingIntent.FLAG_NO_CREATE or PendingIntent.FLAG_IMMUTABLE
            )

            if (pendingIntent != null) {
                alarmManager.cancel(pendingIntent)
                pendingIntent.cancel()
            }

            promise.resolve(true)
        }
        catch (e: Exception) {
            promise.reject("CANCEL_ALARM_ERROR", e.message)
        }
    }
}
```

---

## 3. AlarmBroadcastReceiver.kt

```kotlin
package com.meetingalarms.alarm

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class AlarmBroadcastReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        val alarmId = intent.getIntExtra("alarm_id", -1)
        val meetingTitle = intent.getStringExtra("meeting_title") ?: "Meeting"
        val meetingDescription = intent.getStringExtra("meeting_description") ?: ""

        val activityIntent = Intent(context, AlarmActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
            putExtra("alarm_id", alarmId)
            putExtra("meeting_title", meetingTitle)
            putExtra("meeting_description", meetingDescription)
        }

        context.startActivity(activityIntent)
    }
}
```

---

## 4. AlarmActivity.kt

```kotlin
package com.meetingalarms.alarm

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.WindowManager
import android.widget.Button
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import com.meetingalarms.R
import java.text.SimpleDateFormat
import java.util.*

class AlarmActivity : AppCompatActivity() {

    private lateinit var audioManager: AlarmAudioManager
    private val handler = Handler(Looper.getMainLooper())

    private val clockRunnable = object : Runnable {
        override fun run() {
            updateClock()
            handler.postDelayed(this, 60_000)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Lock screen bypass flags
        window.addFlags(
            WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
            WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON or
            WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
        )
        setShowWhenLocked(true)
        setTurnScreenOn(true)

        setContentView(R.layout.activity_alarm)

        val alarmId = intent.getIntExtra("alarm_id", -1)
        val title = intent.getStringExtra("meeting_title") ?: "Meeting"
        val description = intent.getStringExtra("meeting_description") ?: ""

        // Bind UI
        findViewById<TextView>(R.id.tv_meeting_title).text = title
        findViewById<TextView>(R.id.tv_meeting_description).text = description

        // Start clock
        handler.post(clockRunnable)

        // Start audio
        audioManager = AlarmAudioManager(this)
        audioManager.play()

        // Vibrate
        audioManager.vibrate()

        // Snooze buttons
        listOf(1 to R.id.btn_snooze_1, 5 to R.id.btn_snooze_5, 10 to R.id.btn_snooze_10)
            .forEach { (minutes, buttonId) ->
                findViewById<Button>(buttonId).setOnClickListener {
                    snooze(alarmId, minutes)
                }
            }

        // Stop button
        findViewById<Button>(R.id.btn_stop).setOnClickListener {
            stop()
        }
    }

    private fun snooze(alarmId: Int, minutes: Int) {
        audioManager.stop()
        val newTriggerTime = System.currentTimeMillis() + (minutes * 60_000L)
        rescheduleAlarm(alarmId, newTriggerTime)
        finish()
    }

    private fun stop() {
        audioManager.stop()
        finish()
    }

    private fun rescheduleAlarm(alarmId: Int, triggerTime: Long) {
        val alarmManager = getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val intent = Intent(this, AlarmBroadcastReceiver::class.java).apply {
            putExtra("alarm_id", alarmId)
            putExtra("meeting_title", this@AlarmActivity.intent.getStringExtra("meeting_title"))
            putExtra("meeting_description", this@AlarmActivity.intent.getStringExtra("meeting_description"))
        }
        val pendingIntent = PendingIntent.getBroadcast(
            this,
            alarmId,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerTime, pendingIntent)
    }

    private fun updateClock() {
        val fmt = SimpleDateFormat("h:mm a", Locale.getDefault())
        findViewById<TextView>(R.id.tv_current_time).text = fmt.format(Date())
    }

    override fun onDestroy() {
        super.onDestroy()
        handler.removeCallbacks(clockRunnable)
        audioManager.release()
    }
}
```

---

## 5. AlarmAudioManager.kt

```kotlin
package com.meetingalarms.alarm

import android.content.Context
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.os.*

class AlarmAudioManager(private val context: Context) {

    private var mediaPlayer: MediaPlayer? = null
    private var vibrator: Vibrator? = null
    private var vibratorManager: VibratorManager? = null

    fun play() {
        val soundPath = readAlarmSoundPath()
        val attributes = AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_ALARM)
            .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
            .build()

        mediaPlayer = if (soundPath.isNotEmpty()) {
            MediaPlayer().apply {
                setAudioAttributes(attributes)
                setDataSource(soundPath)
                isLooping = true
                prepare()
            }
        }
        else {
            MediaPlayer.create(context, android.provider.Settings.System.DEFAULT_ALARM_ALERT_URI).apply {
                setAudioAttributes(attributes)
                isLooping = true
            }
        }

        mediaPlayer?.start()
    }

    fun vibrate() {
        val pattern = longArrayOf(0, 500, 300, 500, 300, 1000)

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            vibratorManager = context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager
            vibratorManager?.defaultVibrator?.vibrate(
                VibrationEffect.createWaveform(pattern, 0)
            )
        }
        else {
            @Suppress("DEPRECATION")
            vibrator = context.getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
            vibrator?.vibrate(VibrationEffect.createWaveform(pattern, 0))
        }
    }

    fun stop() {
        mediaPlayer?.stop()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            vibratorManager?.defaultVibrator?.cancel()
        }
        else {
            vibrator?.cancel()
        }
    }

    fun release() {
        mediaPlayer?.release()
        mediaPlayer = null
    }

    private fun readAlarmSoundPath(): String {
        // Read from MMKV — use JNI or shared prefs bridge since MMKV is JS-side
        // Simple approach: store the path in Android SharedPreferences from the RN settings bridge
        val prefs = context.getSharedPreferences("MeetingAlarmsSettings", Context.MODE_PRIVATE)
        return prefs.getString("alarm_sound_path", "") ?: ""
    }
}
```

---

## 6. BootReceiver.kt

```kotlin
package com.meetingalarms.alarm

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class BootReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Intent.ACTION_BOOT_COMPLETED) {
            // Send a local broadcast to the React Native app to re-schedule alarms
            // The RN app will read all future alarms from WatermelonDB and call AlarmModule.scheduleAlarm() for each
            val rescheduleIntent = Intent(context, RescheduleAlarmsService::class.java)
            context.startForegroundService(rescheduleIntent)
        }
    }
}
```

---

## 7. TypeScript Bridge (`src/modules/AlarmModule.ts`)

```typescript
import { NativeModules } from 'react-native';

const { AlarmModule: NativeAlarmModule } = NativeModules;

interface AlarmModuleInterface {
  scheduleAlarm(
    alarmId: number,
    triggerTimeMs: number,
    meetingTitle: string,
    meetingDescription: string,
  ): Promise<boolean>;
  cancelAlarm(alarmId: number): Promise<boolean>;
}

const AlarmModule = NativeAlarmModule as AlarmModuleInterface;

export default AlarmModule;
```

---

## 8. AlarmService.ts (Service Layer)

```typescript
// src/services/AlarmService.ts

import { database } from '../db/database';
import Alarm from '../db/models/Alarm';
import Meeting from '../db/models/Meeting';
import AlarmModule from '../modules/AlarmModule';
import NotificationService from './NotificationService';
import { getSettings } from '../store/useSettingsStore';
import { addMinutes } from 'date-fns';
import { Q } from '@nozbe/watermelondb';

let nextAlarmId = 1; // Increment per alarm; persist in MMKV to survive restarts

async function scheduleMeeting(params: {
  title: string;
  description: string;
  startTime: number;
  endTime: number;
  gcalEventId: string | null;
  selectedOffsetIds: string[];
  colorIndex: number;
}): Promise<void> {
  const { notificationOffsetMinutes, alarmPresets } = getSettings();
  const selectedPresets = alarmPresets.filter(p => params.selectedOffsetIds.includes(p.id));

  await database.write(async () => {
    const meeting = await database.get<Meeting>('meetings').create(m => {
      m.title = params.title;
      m.description = params.description;
      m.startTime = params.startTime;
      m.endTime = params.endTime;
      m.gcalEventId = params.gcalEventId ?? '';
      m.colorIndex = params.colorIndex;
    });

    for (const preset of selectedPresets) {
      const triggerTime = addMinutes(new Date(params.startTime), -preset.minutes).getTime();
      const androidAlarmId = nextAlarmId++;
      const notifTriggerTime = addMinutes(new Date(triggerTime), -notificationOffsetMinutes).getTime();

      await database.get<Alarm>('alarms').create(alarm => {
        alarm.meeting.set(meeting);
        alarm.triggerTime = triggerTime;
        alarm.offsetMinutes = preset.minutes;
        alarm.isDismissed = false;
        alarm.hasNotification = preset.notify;
        alarm.notificationTriggerTime = notifTriggerTime;
        alarm.androidAlarmId = androidAlarmId;
      });

      await AlarmModule.scheduleAlarm(androidAlarmId, triggerTime, params.title, params.description);

      if (preset.notify && notifTriggerTime > Date.now()) {
        await NotificationService.scheduleNotification({
          alarmId: androidAlarmId,
          triggerTime: notifTriggerTime,
          meetingTitle: params.title,
        });
      }
    }
  });
}

async function cancelMeetingAlarms(meeting: Meeting): Promise<void> {
  const alarms = await meeting.alarms.fetch();
  for (const alarm of alarms) {
    await AlarmModule.cancelAlarm(alarm.androidAlarmId);
  }
}

const AlarmService = { scheduleMeeting, cancelMeetingAlarms };
export default AlarmService;
```

---

## 9. `android_alarm_id` Persistence

The `nextAlarmId` counter must survive app restarts. Use MMKV to persist it:

```typescript
import { MMKV } from 'react-native-mmkv';
const storage = new MMKV();

function getNextAlarmId(): number {
  const current = storage.getNumber('next_alarm_id') ?? 1;
  storage.set('next_alarm_id', current + 1);
  return current;
}
```

Also write to Android `SharedPreferences` so the `BootReceiver` / Kotlin side can access the same counter if needed.
