# Critical Development Notes & Gotchas

## 1. The Android Alarm & Full-Screen Intent Quagmire
Because this app needs to function exactly like the default Android clock (waking the device, overlaying the lock screen), standard push notifications will not work. 
* **Permissions:** You must declare `<uses-permission android:name="android.permission.USE_FULL_SCREEN_INTENT" />` in your `AndroidManifest.xml`.
* **Android 14 (API 34) Restrictions:** Google severely restricted full-screen intents in Android 14. Unless your app is a designated dialer or clock app, this permission is **no longer granted by default**. You must build a UI flow that directs the user to Android Settings to manually grant this permission upon first launch.
* **Exact Alarms:** You need `<uses-permission android:name="android.permission.SCHEDULE_EXACT_ALARM" />`. Like full-screen intents, Android 14 requires users to grant this manually.

## 2. Audio Streams (The Volume Requirement)
By default, most audio libraries in React Native use the `STREAM_MUSIC` (media) volume. If a user mutes their media, your alarm will be silent.
* When configuring your audio player (either via a library or custom Kotlin code), you must explicitly set the audio attribute to use the alarm stream:
    ```kotlin
    val audioAttributes = AudioAttributes.Builder()
        .setUsage(AudioAttributes.USAGE_ALARM)
        .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
        .build()
    ```
* To allow users to adjust the app's internal volume relative to the system volume, you will need a library like `react-native-system-setting` to read/write the device's `STREAM_ALARM` volume level via your settings sliders.

## 3. The "Fail-Safe" GCal Sync
Google OAuth refresh tokens can expire or be revoked. 
* **Implementation:** Wrap your Google Calendar fetch logic in a `try/catch`. If the API returns a `401 Unauthorized`, trigger an immediate local notification (using Notifee) or an in-app toast/modal alerting the user: *"Calendar Sync Failed: Please re-authenticate in Settings."* Do not silently fail, or the user will miss meetings.

## 4. UI/UX Custom Logic Constraints
* **Time Formatting Math:** For the duration formatting (e.g., 90 mins -> 1 hour and 30 mins), use a simple modulo function:
    ```javascript
    const formatDuration = (minutes) => {
      const hrs = Math.floor(minutes / 60);
      const mins = minutes % 60;
      if (hrs > 0 && mins > 0) return `${hrs} hour${hrs > 1 ? 's' : ''} and ${mins} minute${mins > 1 ? 's' : ''}`;
      if (hrs > 0) return `${hrs} hour${hrs > 1 ? 's' : ''}`;
      return `${mins} minute${mins > 1 ? 's' : ''}`;
    };
    ```
* **Notification Offset:** If an alarm is set for 1:30 PM, and the offset is 5 minutes, schedule a standard local notification (non-waking) for 1:25 PM. If the user taps the notification to disable the alarm, you must cancel the `PendingIntent` for the 1:30 PM full-screen alarm in the system's `AlarmManager`.

## 5. Color Palette Formulation
To meet the requirement of 8-10 distinct, non-grayscale pastel colors that apply subtle tints and borders, use the following hex codes. They are mathematically distinct but share a high lightness and moderate saturation to remain muted:

1.  **Red (Salmon):** `#FFADAD`
2.  **Orange (Peach):** `#FFD6A5`
3.  **Yellow (Butter):** `#FDFFB6`
4.  **Green (Mint):** `#CAFFBF`
5.  **Cyan (Ice):** `#9BF6FF`
6.  **Blue (Sky):** `#A0C4FF`
7.  **Purple (Lavender):** `#BDB2FF`
8.  **Magenta (Mauve):** `#FFC6FF`

*Implementation Tip:* Use the hex code for the border, and apply a `15%` opacity version of the same hex code to the background of the meeting card.

## 6. Zombie Alarms & Cleanup
* **Requirement:** Remove events and alarms 1 hour after the end time.
* **Gotcha:** If the app is force-closed, JavaScript `setTimeout` or background timers will die. 
* **Solution:** Use `WorkManager` (via a library like `react-native-background-actions`) to schedule a daily cleanup task that queries your local database for events where `endTime + retentionPolicy < Date.now()` and deletes them, ensuring the device doesn't get cluttered with orphaned alarms.