# 08 — Google Calendar Integration

## Overview

The Google Calendar integration has two operations:
1. **Import**: Fetch upcoming GCal events and let the user add them as meetings with alarms.
2. **Export**: When the user creates a new meeting manually, optionally write it back to their primary Google Calendar.

All GCal calls use the Google Calendar REST API v3 with OAuth2 tokens obtained via `@react-native-google-signin/google-signin`.

---

## 1. OAuth2 Setup

### Google Cloud Console Configuration

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a new project (or use an existing one)
3. Enable the **Google Calendar API**
4. Create **OAuth 2.0 Client ID** for Android:
   - Application type: Android
   - Package name: `com.meetingalarms` (must match `AndroidManifest.xml`)
   - SHA-1 certificate fingerprint: run `keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android` for the debug SHA-1
5. Note the `webClientId` from the OAuth client (you need this for React Native, not the Android client ID)
6. Store the `webClientId` in a `.env` file: `GCAL_WEB_CLIENT_ID=your_id_here`

### Required Scopes

```
https://www.googleapis.com/auth/calendar.readonly   — For reading events during import
https://www.googleapis.com/auth/calendar.events     — For writing new events
```

> If you only need import (read), you can use just `calendar.readonly`. Add `calendar.events` only if you implement write-back.

---

## 2. Google Sign-In Configuration (`src/services/CalendarService.ts`)

```typescript
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';

GoogleSignin.configure({
  webClientId: process.env.GCAL_WEB_CLIENT_ID,
  scopes: [
    'https://www.googleapis.com/auth/calendar.readonly',
    'https://www.googleapis.com/auth/calendar.events',
  ],
  offlineAccess: true,
});
```

Call `GoogleSignin.configure()` once at app startup in `App.tsx`.

---

## 3. Sign-In Flow

```typescript
async function signIn(): Promise<void> {
  try {
    await GoogleSignin.hasPlayServices();
    const userInfo = await GoogleSignin.signIn();
    const { accessToken } = await GoogleSignin.getTokens();

    // Save to MMKV
    storage.set('gcal_signed_in', true);
    storage.set('gcal_account_email', userInfo.user.email);

    return accessToken;
  }
  catch (error: any) {
    if (error.code === statusCodes.SIGN_IN_CANCELLED) {
      // User cancelled — do nothing
    }
    else if (error.code === statusCodes.IN_PROGRESS) {
      // Sign-in already in progress
    }
    else {
      throw error;
    }
  }
}
```

---

## 4. Fetching Upcoming Events

```typescript
async function fetchUpcomingEvents(): Promise<GCalEvent[]> {
  let tokens;

  try {
    tokens = await GoogleSignin.getTokens();
  }
  catch (error) {
    // Token retrieval failed — trigger fail-safe notification
    triggerSyncFailureAlert();
    return [];
  }

  const now = new Date().toISOString();
  const twoWeeksLater = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

  try {
    const response = await axios.get(
      'https://www.googleapis.com/calendar/v3/calendars/primary/events',
      {
        headers: { Authorization: `Bearer ${tokens.accessToken}` },
        params: {
          timeMin: now,
          timeMax: twoWeeksLater,
          singleEvents: true,
          orderBy: 'startTime',
          maxResults: 50,
        },
      }
    );

    return response.data.items as GCalEvent[];
  }
  catch (error: any) {
    if (error.response?.status === 401) {
      // Token expired — sign out and show alert
      await GoogleSignin.clearCachedAccessToken(tokens.accessToken);
      triggerSyncFailureAlert();
      storage.set('gcal_signed_in', false);
    }
    else {
      triggerSyncFailureAlert();
    }

    return [];
  }
}
```

---

## 5. GCalEvent TypeScript Interface

```typescript
interface GCalEventDateTime {
  dateTime?: string;  // ISO 8601 string; undefined for all-day events
  date?: string;      // YYYY-MM-DD for all-day events
  timeZone?: string;
}

interface GCalEvent {
  id: string;
  summary: string;            // Maps to meeting title
  description?: string;       // Maps to meeting description
  start: GCalEventDateTime;
  end: GCalEventDateTime;
  status: 'confirmed' | 'tentative' | 'cancelled';
}
```

Filter out `status === 'cancelled'` events and all-day events (where `dateTime` is undefined) before displaying in the import modal.

---

## 6. Writing a Meeting Back to GCal

```typescript
async function createEvent(params: {
  title: string;
  description: string;
  startTime: number;
  endTime: number;
}): Promise<string | null> {
  const tokens = await GoogleSignin.getTokens();

  try {
    const response = await axios.post(
      'https://www.googleapis.com/calendar/v3/calendars/primary/events',
      {
        summary: params.title,
        description: params.description,
        start: { dateTime: new Date(params.startTime).toISOString() },
        end: { dateTime: new Date(params.endTime).toISOString() },
      },
      {
        headers: {
          Authorization: `Bearer ${tokens.accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return response.data.id; // Store this as gcal_event_id in WatermelonDB
  }
  catch (error: any) {
    if (error.response?.status === 401) {
      triggerSyncFailureAlert();
      storage.set('gcal_signed_in', false);
    }

    return null;
  }
}
```

---

## 7. Fail-Safe Logic

The fail-safe is triggered whenever the GCal API returns a `401 Unauthorized` or the network is unavailable.

```typescript
function triggerSyncFailureAlert(): void {
  // Option A: In-app toast (if app is in foreground)
  // Use a Zustand store flag that the UI listens to:
  useAppStore.getState().setCalendarSyncError(true);

  // Option B: Local notification (if app is in background)
  NotificationService.showImmediateNotification({
    title: 'Calendar Sync Failed',
    body: 'Could not connect to Google Calendar. Please re-authenticate in Settings.',
  });
}
```

The `calendarSyncError` flag in Zustand causes a dismissible banner to appear at the top of the home screen. Tapping the banner navigates to Settings → Google Calendar section.

---

## 8. Token Refresh Strategy

`@react-native-google-signin/google-signin` handles token refresh automatically as long as `offlineAccess: true` is set in `configure()`. The refresh happens silently when `getTokens()` detects an expired access token.

If the refresh token itself expires (e.g., the user revoked access), `getTokens()` throws an error with code `statusCodes.SIGN_IN_REQUIRED`. Catch this and trigger the fail-safe.

```typescript
try {
  const tokens = await GoogleSignin.getTokens();
  return tokens.accessToken;
}
catch (error: any) {
  if (error.code === statusCodes.SIGN_IN_REQUIRED) {
    storage.set('gcal_signed_in', false);
    triggerSyncFailureAlert();
    return null;
  }
  throw error;
}
```

---

## 9. Preventing Duplicate Imports

When displaying GCal events in the import modal, check whether each event's `id` already exists as a `gcal_event_id` in WatermelonDB:

```typescript
const existingIds = await database
  .get<Meeting>('meetings')
  .query(Q.where('gcal_event_id', Q.notEq('')))
  .fetch()
  .then(meetings => new Set(meetings.map(m => m.gcalEventId)));

const eventsToDisplay = gcalEvents.filter(event => !existingIds.has(event.id));
const alreadyImported = gcalEvents.filter(event => existingIds.has(event.id));
```

Events in `alreadyImported` are shown with a ✓ badge and are non-interactive.

---

## 10. CalendarService Summary Interface

```typescript
const CalendarService = {
  configure: () => void,            // Call at app startup
  signIn: () => Promise<void>,
  signOut: () => Promise<void>,
  isSignedIn: () => Promise<boolean>,
  fetchUpcomingEvents: () => Promise<GCalEvent[]>,
  createEvent: (params) => Promise<string | null>,
  triggerSyncFailureAlert: () => void,
};
```
