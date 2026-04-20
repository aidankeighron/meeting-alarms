# 12 — Permissions

## Overview

This app requires several Android permissions that have become increasingly restrictive with each major Android release, especially in **Android 14 (API 34)**. Failure to handle these correctly will result in silent alarm failures — the most critical category of bug for this app.

---

## Required Permissions Summary

| Permission | Required For | Granted By Default? | API 34 Behavior |
|-----------|-------------|---------------------|----------------|
| `USE_FULL_SCREEN_INTENT` | Lock-screen alarm overlay | ❌ No (API 34+) | Manual grant required |
| `SCHEDULE_EXACT_ALARM` | Alarm fires at exact time | ❌ No (API 34+) | Manual grant required |
| `POST_NOTIFICATIONS` | Pre-alarm notifications | ❌ No (API 33+) | Runtime dialog |
| `VIBRATE` | Alarm vibration | ✅ Normal permission | Auto-granted |
| `WAKE_LOCK` | Keeps CPU alive for alarm | ✅ Normal permission | Auto-granted |
| `RECEIVE_BOOT_COMPLETED` | Re-schedule after reboot | ✅ Normal permission | Auto-granted |
| `INTERNET` | Google Calendar API | ✅ Normal permission | Auto-granted |

---

## 1. Permission Request Flow (First Launch)

Show a permission request sequence the first time the app opens. Do **not** ask all at once — Android best practice is to request permissions contextually, but for alarm apps it is acceptable to explain and request at startup.

```
App first launch
    │
    ▼
Splash/Onboarding Screen
    │
    ▼
Step 1: Request POST_NOTIFICATIONS
    │  Show rationale: "We need permission to show meeting reminders"
    │  → System dialog
    │
    ▼
Step 2: Check SCHEDULE_EXACT_ALARM
    │  If not granted:
    │  Show custom dialog: "Exact alarms are required for this app to work"
    │  "Tap 'Go to Settings' to enable Alarms & Reminders"
    │  → Open ACTION_REQUEST_SCHEDULE_EXACT_ALARM intent
    │
    ▼
Step 3: Check USE_FULL_SCREEN_INTENT
    │  If not granted:
    │  Show custom dialog: "Lock screen alarms require special access"
    │  "Tap 'Go to Settings' to enable Display over other apps"
    │  → Open ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT intent
    │
    ▼
Home Screen
```

---

## 2. Checking SCHEDULE_EXACT_ALARM

This must be checked every time you try to schedule an alarm (not just on first launch), because the user can revoke it from Android Settings at any time.

### TypeScript side (via NativeModule)

```typescript
// In AlarmModule.ts
interface AlarmModuleInterface {
  // ... existing methods
  canScheduleExactAlarms(): Promise<boolean>;
  openExactAlarmSettings(): Promise<void>;
  canUseFullScreenIntent(): Promise<boolean>;
  openFullScreenIntentSettings(): Promise<void>;
}
```

### Kotlin implementation

```kotlin
@ReactMethod
fun canScheduleExactAlarms(promise: Promise) {
    val alarmManager = reactApplicationContext.getSystemService(Context.ALARM_SERVICE) as AlarmManager
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        promise.resolve(alarmManager.canScheduleExactAlarms())
    }
    else {
        promise.resolve(true)  // Always true below API 31
    }
}

@ReactMethod
fun openExactAlarmSettings(promise: Promise) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        val intent = Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM).apply {
            data = Uri.parse("package:${reactApplicationContext.packageName}")
            flags = Intent.FLAG_ACTIVITY_NEW_TASK
        }
        reactApplicationContext.startActivity(intent)
    }
    promise.resolve(true)
}

@ReactMethod
fun canUseFullScreenIntent(promise: Promise) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {  // API 34
        val notificationManager = reactApplicationContext.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        promise.resolve(notificationManager.canUseFullScreenIntent())
    }
    else {
        promise.resolve(true)
    }
}

@ReactMethod
fun openFullScreenIntentSettings(promise: Promise) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
        val intent = Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT).apply {
            data = Uri.parse("package:${reactApplicationContext.packageName}")
            flags = Intent.FLAG_ACTIVITY_NEW_TASK
        }
        reactApplicationContext.startActivity(intent)
    }
    promise.resolve(true)
}
```

---

## 3. PermissionService (`src/services/PermissionService.ts`)

```typescript
import { PermissionsAndroid, Platform } from 'react-native';
import AlarmModule from '../modules/AlarmModule';

async function requestPostNotifications(): Promise<boolean> {
  if (Platform.OS !== 'android') {
    return true;
  }

  if (parseInt(Platform.Version as string, 10) < 33) {
    return true;  // Not required before API 33
  }

  const result = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
    {
      title: 'Notification Permission',
      message: 'Meeting Alarms needs permission to send you meeting reminders.',
      buttonPositive: 'Allow',
      buttonNegative: 'Deny',
    }
  );

  return result === PermissionsAndroid.RESULTS.GRANTED;
}

async function ensureExactAlarmPermission(): Promise<boolean> {
  const canSchedule = await AlarmModule.canScheduleExactAlarms();
  return canSchedule;
}

async function ensureFullScreenIntentPermission(): Promise<boolean> {
  const canUse = await AlarmModule.canUseFullScreenIntent();
  return canUse;
}

async function checkAllPermissions(): Promise<{
  notifications: boolean;
  exactAlarms: boolean;
  fullScreenIntent: boolean;
}> {
  const [notifications, exactAlarms, fullScreenIntent] = await Promise.all([
    requestPostNotifications(),
    ensureExactAlarmPermission(),
    ensureFullScreenIntentPermission(),
  ]);

  return { notifications, exactAlarms, fullScreenIntent };
}

const PermissionService = {
  requestPostNotifications,
  ensureExactAlarmPermission,
  ensureFullScreenIntentPermission,
  checkAllPermissions,
};

export default PermissionService;
```

---

## 4. Graceful Degradation

If the user denies `USE_FULL_SCREEN_INTENT`:
- Alarms still fire as high-priority heads-up notifications (no full-screen overlay)
- A persistent warning banner appears on the Home screen: "Lock screen alarms are disabled. Tap here to enable."

If the user denies `SCHEDULE_EXACT_ALARM`:
- Cannot schedule alarms at all
- A full-screen blocker overlay appears on the Home screen with a button to go to Settings
- This is a hard requirement — the app cannot function without it

If the user denies `POST_NOTIFICATIONS`:
- Notification offset feature is disabled
- The notification toggle in Alarm Presets is hidden
- The app still works for alarms only

---

## 5. Checking Permissions Before Scheduling

Every call to `AlarmService.scheduleMeeting()` should guard against missing permissions:

```typescript
async function scheduleMeeting(params: MeetingParams): Promise<'success' | 'no_exact_alarm' | 'no_full_screen_intent'> {
  const canSchedule = await AlarmModule.canScheduleExactAlarms();

  if (!canSchedule) {
    return 'no_exact_alarm';
  }

  // ... rest of scheduling logic

  return 'success';
}
```

The UI then handles the return value by showing the appropriate message or settings redirect.

---

## 6. AndroidManifest.xml (Complete Permissions Block)

```xml
<uses-permission android:name="android.permission.USE_FULL_SCREEN_INTENT" />
<uses-permission android:name="android.permission.SCHEDULE_EXACT_ALARM" />
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
<uses-permission android:name="android.permission.VIBRATE" />
<uses-permission android:name="android.permission.WAKE_LOCK" />
<uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"
    android:maxSdkVersion="32" />
<uses-permission android:name="android.permission.READ_MEDIA_AUDIO" />
```

> **Note:** `READ_MEDIA_AUDIO` is required on Android 13+ for accessing audio files via `DocumentPicker`. `READ_EXTERNAL_STORAGE` covers Android 12 and below.

---

## 7. Play Store Declaration

When submitting to the Play Store, Google requires a **Data Safety** form declaration for apps using `USE_FULL_SCREEN_INTENT`. You must declare:
- That the app is a clock/alarm app
- The specific use case for the full-screen intent

The app must genuinely qualify as an "alarm clock app" for this permission to be approved for distribution. This app meets that definition.
