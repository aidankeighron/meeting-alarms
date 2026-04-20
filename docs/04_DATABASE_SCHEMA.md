# 04 — Database Schema

## Overview

The database uses **WatermelonDB** (SQLite backend) for relational domain data and **MMKV** for flat settings. There are two tables: `meetings` and `alarms`.

---

## WatermelonDB Schema (`src/db/schema.ts`)

```typescript
import { appSchema, tableSchema } from '@nozbe/watermelondb';

export const schema = appSchema({
  version: 1,
  tables: [
    tableSchema({
      name: 'meetings',
      columns: [
        { name: 'title', type: 'string' },
        { name: 'description', type: 'string' },
        { name: 'start_time', type: 'number' },   // Unix ms
        { name: 'end_time', type: 'number' },     // Unix ms
        { name: 'gcal_event_id', type: 'string' }, // null if manually created
        { name: 'color_index', type: 'number' },   // 0–7, used to pick pastel color
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'alarms',
      columns: [
        { name: 'meeting_id', type: 'string', isIndexed: true },
        { name: 'trigger_time', type: 'number' },      // Unix ms
        { name: 'offset_minutes', type: 'number' },    // How many min before meeting
        { name: 'is_dismissed', type: 'boolean' },
        { name: 'has_notification', type: 'boolean' }, // Also fire a notification?
        { name: 'notification_trigger_time', type: 'number' }, // trigger_time - offset
        { name: 'android_alarm_id', type: 'number' },  // ID used with AlarmManager
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
  ],
});
```

---

## Model Definitions

### Meeting Model (`src/db/models/Meeting.ts`)

```typescript
import { Model } from '@nozbe/watermelondb';
import { children, date, field, readonly } from '@nozbe/watermelondb/decorators';
import type Alarm from './Alarm';

export default class Meeting extends Model {
  static table = 'meetings';

  static associations = {
    alarms: { type: 'has_many' as const, foreignKey: 'meeting_id' },
  };

  @field('title') title!: string;
  @field('description') description!: string;
  @field('start_time') startTime!: number;
  @field('end_time') endTime!: number;
  @field('gcal_event_id') gcalEventId!: string | null;
  @field('color_index') colorIndex!: number;
  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;

  @children('alarms') alarms!: Alarm[];
}
```

### Alarm Model (`src/db/models/Alarm.ts`)

```typescript
import { Model } from '@nozbe/watermelondb';
import { date, field, readonly, relation } from '@nozbe/watermelondb/decorators';
import type Meeting from './Meeting';

export default class Alarm extends Model {
  static table = 'alarms';

  static associations = {
    meetings: { type: 'belongs_to' as const, key: 'meeting_id' },
  };

  @field('meeting_id') meetingId!: string;
  @field('trigger_time') triggerTime!: number;
  @field('offset_minutes') offsetMinutes!: number;
  @field('is_dismissed') isDismissed!: boolean;
  @field('has_notification') hasNotification!: boolean;
  @field('notification_trigger_time') notificationTriggerTime!: number;
  @field('android_alarm_id') androidAlarmId!: number;
  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;

  @relation('meetings', 'meeting_id') meeting!: Meeting;
}
```

---

## Database Initialization (`src/db/database.ts`)

```typescript
import { Database } from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';
import { schema } from './schema';
import Meeting from './models/Meeting';
import Alarm from './models/Alarm';

const adapter = new SQLiteAdapter({
  schema,
  dbName: 'MeetingAlarmsDB',
  jsi: true,               // Enables faster JS Interface mode
  migrationEvents: true,
});

export const database = new Database({
  adapter,
  modelClasses: [Meeting, Alarm],
});
```

---

## MMKV Settings Keys

The settings store uses MMKV with the following key schema. All values are serialized as JSON strings because MMKV's native `set` only accepts primitives, but the `JSON.stringify` / `JSON.parse` pattern handles arrays.

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `alarm_presets` | `AlarmPreset[]` (JSON) | `[{minutes:10,notify:true},{minutes:30,notify:false},{minutes:60,notify:false}]` | User-defined alarm offset options |
| `notification_offset_minutes` | `number` | `5` | Minutes before alarm that notification fires |
| `retention_hours` | `number` | `1` | Hours after event end before auto-delete |
| `alarm_sound_path` | `string` | `''` (system default) | File path to custom `.mp3` / `.wav` |
| `alarm_volume` | `number` | `0.8` | App-internal volume multiplier (0.0–1.0) |
| `vibration_intensity` | `number` | `1.0` | Vibration amplitude (0.0–1.0) |
| `gcal_signed_in` | `boolean` | `false` | Whether user is currently authenticated |
| `gcal_account_email` | `string` | `''` | Display email for settings UI |

### AlarmPreset TypeScript Interface

```typescript
interface AlarmPreset {
  id: string;          // UUID, stable identifier
  minutes: number;     // Duration before meeting in minutes
  notify: boolean;     // Also send a notification?
}
```

---

## Entity Relationship Diagram

```
┌─────────────────────────────┐
│           meetings           │
├─────────────────────────────┤
│ id (PK, auto)               │
│ title                       │
│ description                 │
│ start_time (Unix ms)        │
│ end_time   (Unix ms)        │
│ gcal_event_id (nullable)    │
│ color_index                 │
│ created_at                  │
│ updated_at                  │
└──────────────┬──────────────┘
               │ has_many
               ▼
┌─────────────────────────────┐
│            alarms            │
├─────────────────────────────┤
│ id (PK, auto)               │
│ meeting_id (FK → meetings)  │
│ trigger_time (Unix ms)      │
│ offset_minutes              │
│ is_dismissed                │
│ has_notification            │
│ notification_trigger_time   │
│ android_alarm_id            │
│ created_at                  │
│ updated_at                  │
└─────────────────────────────┘
```

---

## Query Patterns

### Fetch all upcoming meetings (sorted)

```typescript
const meetings = await database
  .get<Meeting>('meetings')
  .query(
    Q.where('end_time', Q.gt(Date.now())),
    Q.sortBy('start_time', Q.asc),
  )
  .fetch();
```

### Fetch all alarms for a meeting

```typescript
const alarms = await meeting.alarms.fetch();
```

### Fetch upcoming, non-dismissed alarms (for Timers screen)

```typescript
const alarms = await database
  .get<Alarm>('alarms')
  .query(
    Q.where('trigger_time', Q.gt(Date.now())),
    Q.where('is_dismissed', false),
    Q.sortBy('trigger_time', Q.asc),
  )
  .fetch();
```

### Delete meeting and cascade alarms

```typescript
await database.write(async () => {
  const meetingAlarms = await meeting.alarms.fetch();
  await Promise.all(meetingAlarms.map(alarm => alarm.destroyPermanently()));
  await meeting.destroyPermanently();
});
```

> **Note:** WatermelonDB does **not** automatically cascade deletes. You must manually delete child `Alarm` records before deleting the parent `Meeting`. Failing to do so leaves orphaned alarm records that will continue to fire.

---

## Schema Migrations

When the schema changes, increment the `version` number and add a migration step. WatermelonDB will automatically run pending migrations on app startup.

```typescript
import { schemaMigrations, addColumns } from '@nozbe/watermelondb/Schema/migrations';

export const migrations = schemaMigrations({
  migrations: [
    // Example: Adding a snooze_count column in version 2
    {
      toVersion: 2,
      steps: [
        addColumns({
          table: 'alarms',
          columns: [{ name: 'snooze_count', type: 'number' }],
        }),
      ],
    },
  ],
});
```
