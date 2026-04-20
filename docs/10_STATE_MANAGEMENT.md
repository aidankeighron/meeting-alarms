# 10 — State Management

## Overview

State is split between two layers:
- **Zustand** — transient, in-memory UI state that doesn't need to survive app restarts
- **MMKV** — persistent settings key-value store (see `04_DATABASE_SCHEMA.md` for keys)
- **WatermelonDB** — persistent relational data for meetings and alarms (reactive via observers)

---

## 1. Global App Store (`src/store/useAppStore.ts`)

Holds transient UI state: modal visibility, GCal sync errors, loading indicators.

```typescript
import { create } from 'zustand';

interface AppState {
  // Calendar sync
  calendarSyncError: boolean;
  setCalendarSyncError: (error: boolean) => void;
  clearCalendarSyncError: () => void;

  // Modal visibility
  isAddMeetingOpen: boolean;
  openAddMeeting: () => void;
  closeAddMeeting: () => void;

  isImportCalendarOpen: boolean;
  openImportCalendar: () => void;
  closeImportCalendar: () => void;

  // Loading
  isGcalFetching: boolean;
  setGcalFetching: (loading: boolean) => void;

  // Color index counter (wraps at 8 to cycle through palette)
  nextColorIndex: number;
  consumeColorIndex: () => number;
}

const useAppStore = create<AppState>((set, get) => ({
  calendarSyncError: false,
  setCalendarSyncError: (error) => set({ calendarSyncError: error }),
  clearCalendarSyncError: () => set({ calendarSyncError: false }),

  isAddMeetingOpen: false,
  openAddMeeting: () => set({ isAddMeetingOpen: true }),
  closeAddMeeting: () => set({ isAddMeetingOpen: false }),

  isImportCalendarOpen: false,
  openImportCalendar: () => set({ isImportCalendarOpen: true }),
  closeImportCalendar: () => set({ isImportCalendarOpen: false }),

  isGcalFetching: false,
  setGcalFetching: (loading) => set({ isGcalFetching: loading }),

  nextColorIndex: 0,
  consumeColorIndex: () => {
    const current = get().nextColorIndex;
    set({ nextColorIndex: (current + 1) % 8 });
    return current;
  },
}));

export default useAppStore;
```

---

## 2. Settings Store (`src/store/useSettingsStore.ts`)

Bridges MMKV persistence with a Zustand store. Settings are read from MMKV on store initialization, and every update writes back to MMKV synchronously.

```typescript
import { create } from 'zustand';
import { MMKV } from 'react-native-mmkv';

const storage = new MMKV({ id: 'settings-store' });

interface AlarmPreset {
  id: string;
  minutes: number;
  notify: boolean;
}

interface SettingsState {
  alarmPresets: AlarmPreset[];
  notificationOffsetMinutes: number;
  retentionHours: number;
  alarmSoundPath: string;
  alarmVolume: number;
  vibrationIntensity: number;
  gcalSignedIn: boolean;
  gcalAccountEmail: string;

  setAlarmPresets: (presets: AlarmPreset[]) => void;
  addAlarmPreset: (preset: AlarmPreset) => void;
  removeAlarmPreset: (id: string) => void;
  togglePresetNotify: (id: string) => void;

  setNotificationOffset: (minutes: number) => void;
  setRetentionHours: (hours: number) => void;
  setAlarmSoundPath: (path: string) => void;
  setAlarmVolume: (volume: number) => void;
  setVibrationIntensity: (intensity: number) => void;
  setGcalSignedIn: (signedIn: boolean, email?: string) => void;
}

const defaultPresets: AlarmPreset[] = [
  { id: 'preset-1', minutes: 10, notify: true },
  { id: 'preset-2', minutes: 30, notify: false },
  { id: 'preset-3', minutes: 60, notify: false },
];

function readPresets(): AlarmPreset[] {
  const raw = storage.getString('alarm_presets');
  return raw ? JSON.parse(raw) : defaultPresets;
}

function writePresets(presets: AlarmPreset[]): void {
  storage.set('alarm_presets', JSON.stringify(presets));
}

const useSettingsStore = create<SettingsState>((set, get) => ({
  alarmPresets: readPresets(),
  notificationOffsetMinutes: storage.getNumber('notification_offset_minutes') ?? 5,
  retentionHours: storage.getNumber('retention_hours') ?? 1,
  alarmSoundPath: storage.getString('alarm_sound_path') ?? '',
  alarmVolume: storage.getNumber('alarm_volume') ?? 0.8,
  vibrationIntensity: storage.getNumber('vibration_intensity') ?? 1.0,
  gcalSignedIn: storage.getBoolean('gcal_signed_in') ?? false,
  gcalAccountEmail: storage.getString('gcal_account_email') ?? '',

  setAlarmPresets: (presets) => {
    writePresets(presets);
    set({ alarmPresets: presets });
  },

  addAlarmPreset: (preset) => {
    const presets = [...get().alarmPresets, preset];
    writePresets(presets);
    set({ alarmPresets: presets });
  },

  removeAlarmPreset: (id) => {
    const presets = get().alarmPresets.filter(p => p.id !== id);
    writePresets(presets);
    set({ alarmPresets: presets });
  },

  togglePresetNotify: (id) => {
    const presets = get().alarmPresets.map(p =>
      p.id === id ? { ...p, notify: !p.notify } : p
    );
    writePresets(presets);
    set({ alarmPresets: presets });
  },

  setNotificationOffset: (minutes) => {
    storage.set('notification_offset_minutes', minutes);
    set({ notificationOffsetMinutes: minutes });
  },

  setRetentionHours: (hours) => {
    storage.set('retention_hours', hours);
    set({ retentionHours: hours });
  },

  setAlarmSoundPath: (path) => {
    storage.set('alarm_sound_path', path);
    // Also mirror to Android SharedPreferences for Kotlin AlarmAudioManager
    // Call a NativeModule method: SettingsModule.setAlarmSoundPath(path)
    set({ alarmSoundPath: path });
  },

  setAlarmVolume: (volume) => {
    storage.set('alarm_volume', volume);
    set({ alarmVolume: volume });
  },

  setVibrationIntensity: (intensity) => {
    storage.set('vibration_intensity', intensity);
    set({ vibrationIntensity: intensity });
  },

  setGcalSignedIn: (signedIn, email = '') => {
    storage.set('gcal_signed_in', signedIn);
    storage.set('gcal_account_email', email);
    set({ gcalSignedIn: signedIn, gcalAccountEmail: email });
  },
}));

export default useSettingsStore;

// Convenience getter for use outside of React components (e.g., in AlarmService.ts)
export function getSettings() {
  return useSettingsStore.getState();
}
```

---

## 3. WatermelonDB Reactive Queries

WatermelonDB queries are connected to React components using the `withObservables` HOC. This automatically re-renders the component when the underlying data changes.

### Home Screen Meeting List

```typescript
import { withObservables } from '@nozbe/watermelondb/react';
import { Q } from '@nozbe/watermelondb';
import { database } from '../db/database';

const enhance = withObservables([], () => ({
  meetings: database
    .get<Meeting>('meetings')
    .query(Q.where('end_time', Q.gt(Date.now())), Q.sortBy('start_time', Q.asc))
    .observe(),
}));

export const EnhancedMeetingList = enhance(MeetingList);
```

### Timers Screen Alarm List

```typescript
const enhance = withObservables([], () => ({
  alarms: database
    .get<Alarm>('alarms')
    .query(
      Q.where('trigger_time', Q.gt(Date.now())),
      Q.sortBy('trigger_time', Q.asc),
    )
    .observe(),
}));

export const EnhancedTimerList = enhance(TimerList);
```

---

## 4. Data Flow Summary

```
User action (UI)
    │
    ▼
Zustand setter (transient UI state)  ←→  MMKV (settings persistence)
    │
    ▼
Service layer (AlarmService, CalendarService, etc.)
    │
    ├─► WatermelonDB.write()  →  SQLite (persistent relational data)
    │         │
    │         └──── observers notify  →  Zustand-connected components re-render
    │
    └─► AlarmModule / NotificationService  →  Android system
```

No component should directly read from or write to the database or native modules. All such operations go through the service layer.
