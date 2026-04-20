# 05 — Navigation

## Overview

Navigation uses **React Navigation 6** with a **Drawer Navigator** wrapping a **Stack Navigator**. The drawer handles the hamburger menu; the stack handles the main content area including full-screen modals.

---

## Full Screen Map

```
AppNavigator (DrawerNavigator)
│
├── HomeStack (StackNavigator)
│   ├── HomeScreen                ← Default landing screen
│   ├── AddMeetingModal           ← Stack modal (slides up)
│   ├── EditMeetingModal          ← Stack modal (slides up)
│   └── ImportCalendarModal       ← Stack modal (slides up)
│
├── TimersScreen                  ← Drawer item: "Timers"
│
└── SettingsScreen                ← Drawer item: "Settings"
```

---

## Navigator Setup (`src/navigation/AppNavigator.tsx`)

```tsx
import { NavigationContainer } from '@react-navigation/native';
import { createDrawerNavigator } from '@react-navigation/drawer';
import HomeStack from './HomeStack';
import TimersScreen from '../screens/TimersScreen';
import SettingsScreen from '../screens/SettingsScreen';
import CustomDrawerContent from '../components/common/CustomDrawerContent';

const Drawer = createDrawerNavigator();

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Drawer.Navigator
        drawerContent={(props) => <CustomDrawerContent {...props} />}
        screenOptions={{
          drawerPosition: 'left',
          headerShown: false,
        }}
      >
        <Drawer.Screen name="HomeStack" component={HomeStack} />
        <Drawer.Screen name="Timers" component={TimersScreen} />
        <Drawer.Screen name="Settings" component={SettingsScreen} />
      </Drawer.Navigator>
    </NavigationContainer>
  );
}
```

---

## Home Stack (`src/navigation/HomeStack.tsx`)

```tsx
import { createStackNavigator } from '@react-navigation/stack';
import HomeScreen from '../screens/HomeScreen';
import AddMeetingModal from '../screens/modals/AddMeetingModal';
import EditMeetingModal from '../screens/modals/EditMeetingModal';
import ImportCalendarModal from '../screens/modals/ImportCalendarModal';

const Stack = createStackNavigator();

export default function HomeStack() {
  return (
    <Stack.Navigator
      screenOptions={{ headerShown: false }}
    >
      <Stack.Screen name="Home" component={HomeScreen} />
      <Stack.Group screenOptions={{ presentation: 'modal' }}>
        <Stack.Screen name="AddMeeting" component={AddMeetingModal} />
        <Stack.Screen name="EditMeeting" component={EditMeetingModal} />
        <Stack.Screen name="ImportCalendar" component={ImportCalendarModal} />
      </Stack.Group>
    </Stack.Navigator>
  );
}
```

---

## Custom Drawer Content

The drawer should display:

1. App name / logo at the top
2. Navigation items with icons:
   - 🏠 **Home** — `Ionicons: home-outline`
   - ⏰ **Timers** — `Ionicons: alarm-outline`
   - ⚙️ **Settings** — `Ionicons: settings-outline`
3. App version number at the bottom

The active item should use the primary accent color as a background highlight.

---

## TypeScript Navigation Types

Define route params to get full type safety throughout the app.

```typescript
// src/navigation/types.ts

export type HomeStackParamList = {
  Home: undefined;
  AddMeeting: undefined;
  EditMeeting: { meetingId: string };
  ImportCalendar: undefined;
};

export type DrawerParamList = {
  HomeStack: NavigatorScreenParams<HomeStackParamList>;
  Timers: undefined;
  Settings: undefined;
};
```

Usage in screens:

```typescript
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { HomeStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<HomeStackParamList, 'EditMeeting'>;

export default function EditMeetingModal({ route }: Props) {
  const { meetingId } = route.params;
  // ...
}
```

---

## Navigation Gestures

- **Swipe from left edge** → opens the drawer (default React Navigation behavior)
- **Tap outside drawer** → closes the drawer
- **Modals** use the default iOS-style bottom-to-top slide animation on Android (via `presentation: 'modal'` in stack options)

---

## Header Configuration

Each screen that needs a header (HomeScreen, TimersScreen, SettingsScreen) defines its own header via `navigation.setOptions()` inside `useLayoutEffect`. This keeps header logic co-located with the screen.

HomeScreen header:
- Left: hamburger icon → `navigation.openDrawer()`
- Title: "Meetings"
- Right: import calendar icon button → `navigation.navigate('ImportCalendar')`

TimersScreen header:
- Left: hamburger icon
- Title: "Timers"

SettingsScreen header:
- Left: hamburger icon
- Title: "Settings"
