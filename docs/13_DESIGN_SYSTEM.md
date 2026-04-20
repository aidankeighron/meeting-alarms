# 13 — Design System

## Overview

The design system defines the visual language of the app — colors, typography, spacing, component styles, and the pastel meeting color palette. All visual decisions are centralized here. Components reference these tokens; they never use raw hex values or hardcoded numbers.

---

## 1. Color Palette

### Base Theme Colors (`src/theme/colors.ts`)

The app uses a **dark mode** design by default. The primary accent is a calm blue-purple.

```typescript
export const Colors = {
  // Backgrounds
  background: '#0F0F14',       // Very dark near-black
  surface: '#1A1A24',          // Card background
  surfaceElevated: '#242433',  // Modal / elevated surface

  // Text
  textPrimary: '#F0F0FF',      // Off-white (not pure white — easier on eyes)
  textSecondary: '#9090AA',    // Muted text (descriptions, timestamps)
  textDisabled: '#505060',     // Disabled / placeholder

  // Accent
  accent: '#7C6DFA',           // Primary purple-blue
  accentLight: '#A99BFF',      // Lighter version for hover / icons
  accentDark: '#5144C9',       // Pressed state

  // Status
  success: '#4CAF87',
  warning: '#F5A623',
  error: '#E05252',

  // Borders
  borderSubtle: '#2A2A3A',
  borderStrong: '#3A3A50',

  // Overlay
  overlay: 'rgba(0, 0, 0, 0.6)',

  // FAB
  fab: '#7C6DFA',
  fabText: '#FFFFFF',
};
```

---

## 2. Pastel Meeting Color Palette

Eight distinct pastel colors assigned linearly (cyclically) to meetings. The colors are mathematically distinct at high lightness and moderate saturation.

```typescript
export const MeetingColors: MeetingColor[] = [
  { name: 'Salmon',   border: '#FFADAD', background: 'rgba(255, 173, 173, 0.12)' },
  { name: 'Peach',    border: '#FFD6A5', background: 'rgba(255, 214, 165, 0.12)' },
  { name: 'Butter',   border: '#FDFFB6', background: 'rgba(253, 255, 182, 0.12)' },
  { name: 'Mint',     border: '#CAFFBF', background: 'rgba(202, 255, 191, 0.12)' },
  { name: 'Ice',      border: '#9BF6FF', background: 'rgba(155, 246, 255, 0.12)' },
  { name: 'Sky',      border: '#A0C4FF', background: 'rgba(160, 196, 255, 0.12)' },
  { name: 'Lavender', border: '#BDB2FF', background: 'rgba(189, 178, 255, 0.12)' },
  { name: 'Mauve',    border: '#FFC6FF', background: 'rgba(255, 198, 255, 0.12)' },
];

export interface MeetingColor {
  name: string;
  border: string;      // Used for left border of card
  background: string;  // Used for card background (15% opacity)
}

// Utility to get color for a meeting by its colorIndex
export function getMeetingColor(colorIndex: number): MeetingColor {
  return MeetingColors[colorIndex % MeetingColors.length];
}
```

### Color Assignment

`colorIndex` is assigned when a meeting is created, using a rolling counter in the Zustand store:

```typescript
const colorIndex = useAppStore.getState().consumeColorIndex();
```

This ensures sequential meetings get sequential colors (cycling back after 8).

---

## 3. Typography (`src/theme/typography.ts`)

```typescript
export const Typography = {
  fontFamily: {
    regular: 'Inter-Regular',
    medium: 'Inter-Medium',
    semiBold: 'Inter-SemiBold',
    bold: 'Inter-Bold',
  },
  fontSize: {
    xs: 11,
    sm: 13,
    base: 15,
    md: 17,
    lg: 20,
    xl: 24,
    '2xl': 30,
    '3xl': 38,
    '4xl': 48,   // Alarm time display
  },
  lineHeight: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.75,
  },
};
```

**Font:** Use [Inter](https://fonts.google.com/specimen/Inter) — download the variable font and add to `android/app/src/main/assets/fonts/`.

---

## 4. Spacing (`src/theme/spacing.ts`)

```typescript
export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 24,
  xl: 32,
  '2xl': 48,
  '3xl': 64,
};

export const BorderRadius = {
  sm: 6,
  md: 10,
  lg: 16,
  xl: 24,
  full: 999,
};
```

---

## 5. Component Specs

### MeetingCard

```
┌─[3px border, pastel color]───────────────┐
│  background: pastel 12% opacity          │
│  padding: 16px                           │
│                                          │
│  [Title]                     [✎] [🗑]   │
│  Inter SemiBold, 17px, textPrimary       │
│                                          │
│  Mon Apr 21 · 10:00 – 11:00 AM          │
│  Inter Regular, 13px, textSecondary     │
│                                          │
│  3 alarms scheduled                      │
│  Inter Regular, 11px, textDisabled      │
└──────────────────────────────────────────┘
borderRadius: 10
marginVertical: 6
```

### TimerCard

Same visual structure as `MeetingCard` but shows:
- Large time (`h:mm a`) — `fontSize: 24, fontFamily: semiBold, textPrimary`
- Date below time — `fontSize: 13, textSecondary`
- Meeting title and offset label on the right
- Dismissed state: `opacity: 0.4` on the entire card, gray border override

### FAB (Floating Action Button)

```
Width × Height: 56 × 56
borderRadius: 28 (full circle)
backgroundColor: Colors.accent
Shadow: elevation 6, shadowColor accent
Icon: + (Ionicons, size 28, white)
Position: absolute, bottom: 24, right: 24
```

### Section Header (Settings)

```
Text: Inter SemiBold, 11px, textSecondary
UPPERCASE
paddingHorizontal: 16, paddingTop: 24, paddingBottom: 8
letterSpacing: 1.2
```

### Primary Button

```
backgroundColor: Colors.accent
borderRadius: 12
paddingVertical: 14
paddingHorizontal: 24
Text: Inter SemiBold, 16px, white, centered
active/pressed: backgroundColor accentDark, scale(0.97)
disabled: opacity 0.4
```

### Outlined Button

```
backgroundColor: transparent
borderWidth: 1.5
borderColor: Colors.borderStrong
borderRadius: 12
Same padding and text as Primary
```

### Text Input

```
backgroundColor: Colors.surfaceElevated
borderRadius: 10
borderWidth: 1
borderColor: Colors.borderSubtle
focused: borderColor accentLight
paddingHorizontal: 14, paddingVertical: 12
fontSize: 15, textPrimary
placeholderTextColor: textDisabled
```

### Toggle / Checkbox

Use a custom animated toggle (not default Android) with:
- Pill track: 44 × 24, borderRadius full
- On: backgroundColor accent
- Off: backgroundColor borderStrong
- Thumb: 20 × 20, white circle, animates position on state change using `Animated.timing`

---

## 6. Icons

Use `react-native-vector-icons` with the **Ionicons** set for all icons. Import:

```typescript
import Ionicons from 'react-native-vector-icons/Ionicons';
```

| Usage | Icon name | Size |
|-------|-----------|------|
| Hamburger menu | `menu-outline` | 24 |
| Add (FAB) | `add` | 28 |
| Import calendar | `calendar-outline` | 22 |
| Edit | `pencil-outline` | 18 |
| Delete | `trash-outline` | 18 |
| Alarm | `alarm-outline` | 18 |
| Settings | `settings-outline` | 20 |
| Notification bell | `notifications-outline` / `notifications` | 18 |
| Home | `home-outline` | 20 |
| Check | `checkmark-circle` | 16 |
| Dismiss | `close-circle-outline` | 18 |

---

## 7. Animation Guidelines

- **All state transitions**: Use `Animated.timing` with `duration: 200ms`, `easing: Easing.out(Easing.ease)`
- **Modal open/close**: Provided by React Navigation's default presentation transitions
- **Card press**: `Animated.spring` scale to 0.97 on press, 1.0 on release
- **Toggle switch**: `Animated.timing` `duration: 150ms`
- **Dismissed alarm**: `Animated.timing` opacity to 0.4 over `200ms`

---

## 8. AlarmActivity Theme (Kotlin XML)

The `AlarmActivity` is a native Activity, not a React Native screen. Define its theme in `android/app/src/main/res/values/styles.xml`:

```xml
<style name="Theme.AlarmActivity" parent="Theme.MaterialComponents.DayNight.NoActionBar">
    <item name="android:windowBackground">@color/alarm_background</item>
    <item name="android:statusBarColor">@color/alarm_background</item>
    <item name="android:navigationBarColor">@color/alarm_background</item>
    <item name="android:windowLightStatusBar">false</item>
</style>
```

Define colors in `colors.xml`:

```xml
<color name="alarm_background">#0F0F14</color>
<color name="alarm_text_primary">#F0F0FF</color>
<color name="alarm_accent">#7C6DFA</color>
<color name="alarm_button_stop">#E05252</color>
```

The alarm screen should feel visually consistent with the React Native app — same dark background, same typography choices.
