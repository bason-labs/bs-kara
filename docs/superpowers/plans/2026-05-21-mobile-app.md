# BS-Kara Mobile App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `bk-mobile` React Native/Expo app to full feature parity with the web remote using the same Firebase logic from `@bs-kara/shared`, same color tokens, same icons, and Vietnamese labels.

**Architecture:** Screen-by-screen native port. `@bs-kara/shared` owns all Firebase logic (`useRoom`, `subscribeActiveRooms`, `auth`, `db`, i18n). `bk-mobile` owns only the React Native UI layer plus a thin `ThemeContext`. YouTube search calls the deployed web URL via `EXPO_PUBLIC_API_BASE_URL`.

**Tech Stack:** Expo 53, Expo Router 4, NativeWind v4, lucide-react-native, react-native-youtube-iframe, react-native-draggable-flatlist, @gorhom/bottom-sheet, expo-linear-gradient, @react-native-async-storage/async-storage, jest-expo

---

## File Map

| Action | Path | Responsibility |
|---|---|---|
| Create | `bk-mobile/constants/colors.ts` | Dark + light color token maps |
| Create | `bk-mobile/context/ThemeContext.tsx` | Dark/light toggle, AsyncStorage, NativeWind colorScheme |
| Create | `bk-mobile/context/RoomContext.tsx` | Wraps `useRoom`, shared across all room tabs |
| Create | `bk-mobile/hooks/useRoomGate.ts` | Subscribes to `meta/activeRooms`, returns first active code |
| Create | `bk-mobile/components/GradientButton.tsx` | expo-linear-gradient brand CTA |
| Create | `bk-mobile/components/OTPInput.tsx` | 4–7 digit room-code input |
| Create | `bk-mobile/components/SongResultItem.tsx` | Search result row |
| Create | `bk-mobile/components/NowPlayingCard.tsx` | Compact now-playing strip |
| Create | `bk-mobile/components/QueueItemRow.tsx` | Queue row with drag handle + remove |
| Create | `bk-mobile/components/TransportControls.tsx` | Prev / play-pause / next |
| Create | `bk-mobile/components/EmojiPad.tsx` | Emoji reaction bar |
| Create | `bk-mobile/components/ThemeToggle.tsx` | Sun/Moon icon toggle |
| Create | `bk-mobile/components/SettingsSheet.tsx` | @gorhom/bottom-sheet settings panel |
| Modify | `bk-mobile/app/_layout.tsx` | Add ThemeContext, i18n init, GestureHandlerRootView |
| Modify | `bk-mobile/app/index.tsx` | Gate: subscribe activeRooms → redirect |
| Create | `bk-mobile/app/join.tsx` | Code-entry screen |
| Create | `bk-mobile/app/(room)/_layout.tsx` | Tab bar + RoomContext.Provider |
| Create | `bk-mobile/app/(room)/search.tsx` | Search tab |
| Create | `bk-mobile/app/(room)/queue.tsx` | Queue tab |
| Create | `bk-mobile/app/(room)/player.tsx` | Player tab (hidden when TV online) |
| Modify | `bk-mobile/tailwind.config.js` | Add custom color tokens |
| Modify | `bk-mobile/package.json` | Add dependencies + jest config |
| Create | `bk-mobile/.env` | EXPO_PUBLIC_API_BASE_URL |

---

## Task 1: Install dependencies + jest setup

**Files:**
- Modify: `bk-mobile/package.json`
- Create: `bk-mobile/.env`

- [ ] **Step 1: Install runtime dependencies**

```bash
cd bk-mobile
pnpm add lucide-react-native react-native-svg react-native-youtube-iframe \
  react-native-draggable-flatlist @gorhom/bottom-sheet \
  expo-linear-gradient @react-native-async-storage/async-storage
```

- [ ] **Step 2: Install test devDependencies**

```bash
pnpm add -D jest-expo @testing-library/react-native @types/jest
```

- [ ] **Step 3: Add jest config to bk-mobile/package.json**

Add to `package.json` (under `"scripts"` and `"devDependencies"` already present):

```json
"scripts": {
  "start": "expo start",
  "android": "expo start --android",
  "ios": "expo start --ios",
  "web": "expo start --web",
  "lint": "eslint .",
  "typecheck": "tsc --noEmit",
  "test": "jest"
},
"jest": {
  "preset": "jest-expo",
  "transformIgnorePatterns": [
    "node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|lucide-react-native|@gorhom|react-native-draggable-flatlist|react-native-reanimated)"
  ]
}
```

- [ ] **Step 4: Create bk-mobile/.env**

```
EXPO_PUBLIC_API_BASE_URL=https://bs-kara.vercel.app
```

- [ ] **Step 5: Verify typecheck passes**

```bash
cd bk-mobile && pnpm typecheck
```
Expected: no errors (or only pre-existing ones from the placeholder screens)

- [ ] **Step 6: Commit**

```bash
git add bk-mobile/package.json bk-mobile/.env bk-mobile/pnpm-lock.yaml
git commit -m "chore(mobile): install dependencies and jest setup"
```

---

## Task 2: Color tokens + Tailwind config

**Files:**
- Create: `bk-mobile/constants/colors.ts`
- Modify: `bk-mobile/tailwind.config.js`

- [ ] **Step 1: Write failing test**

Create `bk-mobile/constants/colors.test.ts`:

```typescript
import { DarkColors, LightColors } from './colors';

describe('color tokens', () => {
  it('dark theme has all required tokens', () => {
    expect(DarkColors.bg).toBe('#06100f');
    expect(DarkColors.surface).toBe('#0e1c1c');
    expect(DarkColors.brand).toBe('#008b8b');
    expect(DarkColors.accent).toBe('#40e0d0');
    expect(DarkColors.fg).toBe('#e0ffff');
    expect(DarkColors.muted).toBe('#7aa8a8');
    expect(DarkColors.danger).toBe('#ff5f6d');
  });

  it('light theme has all required tokens', () => {
    expect(LightColors.bg).toBe('#f7f8fa');
    expect(LightColors.surface).toBe('#ffffff');
    expect(LightColors.brand).toBe('#006d6f');
    expect(LightColors.fg).toBe('#0d1a1a');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd bk-mobile && pnpm test -- constants/colors.test.ts
```
Expected: FAIL — `Cannot find module './colors'`

- [ ] **Step 3: Create bk-mobile/constants/colors.ts**

```typescript
export const DarkColors = {
  bg: '#06100f',
  surface: '#0e1c1c',
  surface2: '#152a2a',
  border: '#1f3a3a',
  fg: '#e0ffff',
  muted: '#7aa8a8',
  brand: '#008b8b',
  brand2: '#006d6f',
  accent: '#40e0d0',
  glow: '#7df9ff',
  danger: '#ff5f6d',
  gradientStart: '#008b8b',
  gradientMid: '#006d6f',
  gradientEnd: '#0d98ba',
} as const;

export const LightColors = {
  bg: '#f7f8fa',
  surface: '#ffffff',
  surface2: '#eef1f3',
  border: '#dde3e8',
  fg: '#0d1a1a',
  muted: '#4a7070',
  brand: '#006d6f',
  brand2: '#005557',
  accent: '#006d6f',
  glow: '#008b8b',
  danger: '#d93025',
  gradientStart: '#006d6f',
  gradientMid: '#005557',
  gradientEnd: '#0d98ba',
} as const;

export type ColorTokens = typeof DarkColors;
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd bk-mobile && pnpm test -- constants/colors.test.ts
```
Expected: PASS

- [ ] **Step 5: Update tailwind.config.js to add custom colors**

```javascript
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './components/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        bg: 'var(--color-bg)',
        surface: 'var(--color-surface)',
        surface2: 'var(--color-surface2)',
        border: 'var(--color-border)',
        fg: 'var(--color-fg)',
        muted: 'var(--color-muted)',
        brand: 'var(--color-brand)',
        accent: 'var(--color-accent)',
        danger: 'var(--color-danger)',
      },
    },
  },
  plugins: [],
};
```

- [ ] **Step 6: Commit**

```bash
git add bk-mobile/constants/colors.ts bk-mobile/constants/colors.test.ts bk-mobile/tailwind.config.js
git commit -m "feat(mobile): add color tokens and tailwind config"
```

---

## Task 3: ThemeContext

**Files:**
- Create: `bk-mobile/context/ThemeContext.tsx`

- [ ] **Step 1: Write failing test**

Create `bk-mobile/context/ThemeContext.test.tsx`:

```typescript
import React from 'react';
import { render, act } from '@testing-library/react-native';
import { Text } from 'react-native';
import { ThemeProvider, useTheme } from './ThemeContext';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
jest.mock('nativewind', () => ({
  useColorScheme: () => ({ setColorScheme: jest.fn() }),
}));

function ThemeDisplay() {
  const { theme } = useTheme();
  return <Text testID="theme">{theme}</Text>;
}

describe('ThemeContext', () => {
  it('defaults to dark theme', () => {
    const { getByTestId } = render(
      <ThemeProvider><ThemeDisplay /></ThemeProvider>
    );
    expect(getByTestId('theme').props.children).toBe('dark');
  });

  it('toggles between dark and light', async () => {
    let toggle: () => void;
    function Grabber() {
      const ctx = useTheme();
      toggle = ctx.toggleTheme;
      return <Text testID="theme">{ctx.theme}</Text>;
    }
    const { getByTestId } = render(
      <ThemeProvider><Grabber /></ThemeProvider>
    );
    expect(getByTestId('theme').props.children).toBe('dark');
    await act(async () => { toggle(); });
    expect(getByTestId('theme').props.children).toBe('light');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd bk-mobile && pnpm test -- context/ThemeContext.test.tsx
```
Expected: FAIL — `Cannot find module './ThemeContext'`

- [ ] **Step 3: Create bk-mobile/context/ThemeContext.tsx**

```typescript
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColorScheme } from 'nativewind';

type Theme = 'dark' | 'light';
const STORAGE_KEY = 'karaoke_theme';

interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'dark',
  toggleTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('dark');
  const { setColorScheme } = useColorScheme();

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (stored === 'light' || stored === 'dark') {
        setTheme(stored);
        setColorScheme(stored);
      }
    });
  }, [setColorScheme]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next: Theme = prev === 'dark' ? 'light' : 'dark';
      setColorScheme(next);
      AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
      return next;
    });
  }, [setColorScheme]);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd bk-mobile && pnpm test -- context/ThemeContext.test.tsx
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add bk-mobile/context/ThemeContext.tsx bk-mobile/context/ThemeContext.test.tsx
git commit -m "feat(mobile): add ThemeContext with dark/light toggle and AsyncStorage"
```

---

## Task 4: Update root layout

**Files:**
- Modify: `bk-mobile/app/_layout.tsx`

- [ ] **Step 1: Update app/_layout.tsx**

Replace the entire file:

```typescript
import '../global.css';
import { Stack } from 'expo-router';
import { Suspense } from 'react';
import { Text } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ThemeProvider } from '@/context/ThemeContext';
import { i18n } from '@bs-kara/shared/hooks';

// Ensure i18n singleton is initialized before any screen renders.
void i18n;

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <Suspense fallback={<Text>Loading…</Text>}>
          <Stack screenOptions={{ headerShown: false }} />
        </Suspense>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
```

- [ ] **Step 2: Verify typecheck passes**

```bash
cd bk-mobile && pnpm typecheck
```
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add bk-mobile/app/_layout.tsx
git commit -m "feat(mobile): add GestureHandlerRootView, ThemeProvider, and i18n to root layout"
```

---

## Task 5: useRoomGate hook

**Files:**
- Create: `bk-mobile/hooks/useRoomGate.ts`
- Create: `bk-mobile/hooks/useRoomGate.test.ts`

- [ ] **Step 1: Write failing test**

Create `bk-mobile/hooks/useRoomGate.test.ts`:

```typescript
import { renderHook, act } from '@testing-library/react-native';
import { useRoomGate } from './useRoomGate';

let activeRoomsCallback: (codes: string[]) => void;
let unsubCalled = false;

jest.mock('@bs-kara/shared', () => ({
  subscribeActiveRooms: (cb: (codes: string[]) => void) => {
    activeRoomsCallback = cb;
    return () => { unsubCalled = true; };
  },
}));

describe('useRoomGate', () => {
  beforeEach(() => { unsubCalled = false; });

  it('starts loading with no active room', () => {
    const { result } = renderHook(() => useRoomGate());
    expect(result.current.isLoading).toBe(true);
    expect(result.current.activeRoomCode).toBeNull();
  });

  it('returns first active room code when rooms become available', () => {
    const { result } = renderHook(() => useRoomGate());
    act(() => { activeRoomsCallback(['1234']); });
    expect(result.current.isLoading).toBe(false);
    expect(result.current.activeRoomCode).toBe('1234');
  });

  it('returns null when no rooms are active', () => {
    const { result } = renderHook(() => useRoomGate());
    act(() => { activeRoomsCallback([]); });
    expect(result.current.isLoading).toBe(false);
    expect(result.current.activeRoomCode).toBeNull();
  });

  it('unsubscribes on unmount', () => {
    const { unmount } = renderHook(() => useRoomGate());
    act(() => { activeRoomsCallback([]); });
    unmount();
    expect(unsubCalled).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd bk-mobile && pnpm test -- hooks/useRoomGate.test.ts
```
Expected: FAIL — `Cannot find module './useRoomGate'`

- [ ] **Step 3: Create bk-mobile/hooks/useRoomGate.ts**

```typescript
import { useEffect, useState } from 'react';
import { subscribeActiveRooms } from '@bs-kara/shared';

interface RoomGateState {
  activeRoomCode: string | null;
  isLoading: boolean;
}

export function useRoomGate(): RoomGateState {
  const [activeRoomCode, setActiveRoomCode] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    return subscribeActiveRooms((codes) => {
      setActiveRoomCode(codes.length > 0 ? codes[0] : null);
      setIsLoading(false);
    });
  }, []);

  return { activeRoomCode, isLoading };
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd bk-mobile && pnpm test -- hooks/useRoomGate.test.ts
```
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add bk-mobile/hooks/useRoomGate.ts bk-mobile/hooks/useRoomGate.test.ts
git commit -m "feat(mobile): add useRoomGate hook subscribing to meta/activeRooms"
```

---

## Task 6: Gate screen (app/index.tsx)

**Files:**
- Modify: `bk-mobile/app/index.tsx`

- [ ] **Step 1: Replace app/index.tsx**

```typescript
import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useRoomGate } from '@/hooks/useRoomGate';

export default function GateScreen() {
  const router = useRouter();
  const { activeRoomCode, isLoading } = useRoomGate();

  useEffect(() => {
    if (isLoading) return;
    if (activeRoomCode) {
      router.replace({ pathname: '/(room)', params: { roomCode: activeRoomCode } });
    } else {
      router.replace('/join');
    }
  }, [isLoading, activeRoomCode, router]);

  return (
    <View className="flex-1 items-center justify-center bg-[#06100f] dark:bg-[#06100f]">
      <ActivityIndicator color="#008b8b" size="large" />
    </View>
  );
}
```

- [ ] **Step 2: Verify typecheck passes**

```bash
cd bk-mobile && pnpm typecheck
```
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add bk-mobile/app/index.tsx
git commit -m "feat(mobile): gate screen auto-joins active room or redirects to join"
```

---

## Task 7: OTPInput component + join screen

**Files:**
- Create: `bk-mobile/components/OTPInput.tsx`
- Create: `bk-mobile/app/join.tsx`

- [ ] **Step 1: Write failing test for OTPInput**

Create `bk-mobile/components/OTPInput.test.tsx`:

```typescript
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { OTPInput } from './OTPInput';

describe('OTPInput', () => {
  it('renders a text input', () => {
    const { getByTestId } = render(
      <OTPInput value="" onChange={jest.fn()} onComplete={jest.fn()} />
    );
    expect(getByTestId('otp-input')).toBeTruthy();
  });

  it('calls onChange when user types', () => {
    const onChange = jest.fn();
    const { getByTestId } = render(
      <OTPInput value="" onChange={onChange} onComplete={jest.fn()} />
    );
    fireEvent.changeText(getByTestId('otp-input'), '1234');
    expect(onChange).toHaveBeenCalledWith('1234');
  });

  it('calls onComplete when 4+ digits entered', () => {
    const onComplete = jest.fn();
    const { getByTestId } = render(
      <OTPInput value="" onChange={jest.fn()} onComplete={onComplete} />
    );
    fireEvent.changeText(getByTestId('otp-input'), '12345');
    expect(onComplete).toHaveBeenCalledWith('12345');
  });

  it('does not call onComplete for fewer than 4 digits', () => {
    const onComplete = jest.fn();
    const { getByTestId } = render(
      <OTPInput value="" onChange={jest.fn()} onComplete={onComplete} />
    );
    fireEvent.changeText(getByTestId('otp-input'), '123');
    expect(onComplete).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd bk-mobile && pnpm test -- components/OTPInput.test.tsx
```
Expected: FAIL — `Cannot find module './OTPInput'`

- [ ] **Step 3: Create bk-mobile/components/OTPInput.tsx**

```typescript
import { TextInput, View } from 'react-native';

interface OTPInputProps {
  value: string;
  onChange: (v: string) => void;
  onComplete: (v: string) => void;
  ariaLabel?: string;
}

export function OTPInput({ value, onChange, onComplete, ariaLabel }: OTPInputProps) {
  function handleChange(text: string) {
    const digits = text.replace(/\D/g, '').slice(0, 7);
    onChange(digits);
    if (digits.length >= 4) onComplete(digits);
  }

  return (
    <View className="w-full">
      <TextInput
        testID="otp-input"
        value={value}
        onChangeText={handleChange}
        keyboardType="number-pad"
        maxLength={7}
        placeholder="0000"
        placeholderTextColor="#7aa8a8"
        accessibilityLabel={ariaLabel}
        className="w-full text-center text-4xl font-bold tracking-[0.5em] text-fg bg-surface border border-border rounded-2xl py-5 px-4"
        style={{ letterSpacing: 16 }}
      />
    </View>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd bk-mobile && pnpm test -- components/OTPInput.test.tsx
```
Expected: PASS (4 tests)

- [ ] **Step 5: Create bk-mobile/app/join.tsx**

```typescript
import { useState } from 'react';
import { View, Text, SafeAreaView } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { OTPInput } from '@/components/OTPInput';
import { GradientButton } from '@/components/GradientButton';

const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL ?? '';

type JoinError = 'room_not_found' | 'subscription_expired' | 'error' | null;

export default function JoinScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [code, setCode] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<JoinError>(null);

  async function handleJoin(roomCode: string) {
    if (roomCode.length < 4 || isJoining) return;
    setError(null);
    setIsJoining(true);
    try {
      const res = await fetch(`${API_BASE}/api/room-access?roomCode=${roomCode}`);
      const data = (await res.json()) as { allowed: boolean; reason: string };
      if (!data.allowed) {
        setError((data.reason as JoinError) ?? 'error');
        return;
      }
      router.replace({ pathname: '/(room)', params: { roomCode } });
    } catch {
      setError('error');
    } finally {
      setIsJoining(false);
    }
  }

  function getErrorMessage(): string | null {
    if (error === 'room_not_found') return t('home.invalidCode');
    if (error === 'subscription_expired') return 'Phòng này không còn hoạt động.';
    if (error === 'error') return 'Đã xảy ra lỗi, vui lòng thử lại.';
    return null;
  }

  return (
    <SafeAreaView className="flex-1 bg-[#06100f]">
      <View className="flex-1 items-center justify-center px-6 gap-8">
        <View className="items-center gap-2">
          <Text className="text-3xl font-bold text-fg">BS Kara</Text>
          <Text className="text-sm text-muted text-center">{t('home.subtitle')}</Text>
        </View>
        <OTPInput
          value={code}
          onChange={setCode}
          onComplete={handleJoin}
          ariaLabel={t('home.roomCodeLabel')}
        />
        {getErrorMessage() && (
          <Text className="text-sm text-danger text-center">{getErrorMessage()}</Text>
        )}
        <GradientButton
          label={isJoining ? '…' : t('home.joinButton')}
          onPress={() => handleJoin(code)}
          disabled={code.length < 4 || isJoining}
        />
      </View>
    </SafeAreaView>
  );
}
```

- [ ] **Step 6: Verify typecheck passes**

```bash
cd bk-mobile && pnpm typecheck
```
Expected: no errors

- [ ] **Step 7: Commit**

```bash
git add bk-mobile/components/OTPInput.tsx bk-mobile/components/OTPInput.test.tsx bk-mobile/app/join.tsx
git commit -m "feat(mobile): add OTPInput component and join screen"
```

---

## Task 8: GradientButton + RoomContext

**Files:**
- Create: `bk-mobile/components/GradientButton.tsx`
- Create: `bk-mobile/context/RoomContext.tsx`

- [ ] **Step 1: Write failing test for RoomContext**

Create `bk-mobile/context/RoomContext.test.tsx`:

```typescript
import React from 'react';
import { render } from '@testing-library/react-native';
import { Text } from 'react-native';
import { RoomProvider, useRoomContext } from './RoomContext';

const mockRoomData = { queue: [], currentPlaying: null, isPlaying: false, isTvActive: false };
const mockRoom = {
  roomData: mockRoomData,
  isLoading: false,
  roomExists: true,
  addSongToQueue: jest.fn(),
  removeSong: jest.fn(),
  reorderQueue: jest.fn(),
  togglePlayPause: jest.fn(),
  playNext: jest.fn(),
  playPrevious: jest.fn(),
  sendEmoji: jest.fn(),
  setDragDropEnabled: jest.fn(),
  setRequesterPromptEnabled: jest.fn(),
  setMCEnabled: jest.fn(),
  setMcVoice: jest.fn(),
  setAutoRandomMode: jest.fn(),
  setRandomFilters: jest.fn(),
  setGuestCanRemove: jest.fn(),
  setAiScoringEnabled: jest.fn(),
  resetRoom: jest.fn(),
  removeCurrentPlaying: jest.fn(),
  setCurrentPlayingDirectly: jest.fn(),
  playSongNow: jest.fn(),
  updateRequesterName: jest.fn(),
  addToPlayedHistory: jest.fn(),
  tryClaimAnnouncementLock: jest.fn(),
  setIsPlaying: jest.fn(),
};

jest.mock('@bs-kara/shared/hooks', () => ({
  useRoom: () => mockRoom,
  i18n: {},
}));

function Consumer() {
  const { roomData } = useRoomContext();
  return <Text testID="queue-len">{roomData.queue.length}</Text>;
}

describe('RoomContext', () => {
  it('provides roomData from useRoom', () => {
    const { getByTestId } = render(
      <RoomProvider roomCode="1234"><Consumer /></RoomProvider>
    );
    expect(getByTestId('queue-len').props.children).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd bk-mobile && pnpm test -- context/RoomContext.test.tsx
```
Expected: FAIL — `Cannot find module './RoomContext'`

- [ ] **Step 3: Create bk-mobile/components/GradientButton.tsx**

```typescript
import { TouchableOpacity, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

interface GradientButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}

export function GradientButton({ label, onPress, disabled }: GradientButtonProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.8}
      className="w-full rounded-full overflow-hidden"
      style={{ opacity: disabled ? 0.5 : 1 }}
    >
      <LinearGradient
        colors={['#008b8b', '#006d6f', '#0d98ba']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        className="py-4 items-center"
      >
        <Text className="text-fg font-semibold text-base">{label}</Text>
      </LinearGradient>
    </TouchableOpacity>
  );
}
```

- [ ] **Step 4: Create bk-mobile/context/RoomContext.tsx**

```typescript
import React, { createContext, useContext } from 'react';
import { useRoom } from '@bs-kara/shared/hooks';
import type { RoomState } from '@bs-kara/shared/hooks';

type RoomContextValue = ReturnType<typeof useRoom>;

const RoomContext = createContext<RoomContextValue | null>(null);

export function RoomProvider({
  roomCode,
  children,
}: {
  roomCode: string;
  children: React.ReactNode;
}) {
  const room = useRoom(roomCode);
  return <RoomContext.Provider value={room}>{children}</RoomContext.Provider>;
}

export function useRoomContext(): RoomContextValue {
  const ctx = useContext(RoomContext);
  if (!ctx) throw new Error('useRoomContext must be used inside RoomProvider');
  return ctx;
}

export type { RoomState };
```

- [ ] **Step 5: Run test to verify it passes**

```bash
cd bk-mobile && pnpm test -- context/RoomContext.test.tsx
```
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add bk-mobile/components/GradientButton.tsx bk-mobile/context/RoomContext.tsx bk-mobile/context/RoomContext.test.tsx
git commit -m "feat(mobile): add GradientButton and RoomContext"
```

---

## Task 9: Tab bar layout (app/(room)/_layout.tsx)

**Files:**
- Create: `bk-mobile/app/(room)/_layout.tsx`
- Create: `bk-mobile/components/ThemeToggle.tsx`

- [ ] **Step 1: Create bk-mobile/components/ThemeToggle.tsx**

```typescript
import { TouchableOpacity } from 'react-native';
import { Sun, Moon } from 'lucide-react-native';
import { useTheme } from '@/context/ThemeContext';

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const Icon = theme === 'dark' ? Sun : Moon;
  return (
    <TouchableOpacity onPress={toggleTheme} activeOpacity={0.7} className="p-2">
      <Icon size={20} color="#7aa8a8" />
    </TouchableOpacity>
  );
}
```

- [ ] **Step 2: Create bk-mobile/app/(room)/_layout.tsx**

```typescript
import { Tabs, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Search, ListMusic, Disc3 } from 'lucide-react-native';
import { RoomProvider, useRoomContext } from '@/context/RoomContext';

function TabBarLayout() {
  const { t } = useTranslation();
  const { roomData } = useRoomContext();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#0e1c1c',
          borderTopColor: '#1f3a3a',
          height: 64,
        },
        tabBarActiveTintColor: '#40e0d0',
        tabBarInactiveTintColor: '#7aa8a8',
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="search"
        options={{
          title: t('tabs.search'),
          tabBarIcon: ({ color }) => <Search size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="queue"
        options={{
          title: t('tabs.queue'),
          tabBarIcon: ({ color }) => <ListMusic size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="player"
        options={{
          title: t('tabs.player'),
          tabBarIcon: ({ color }) => <Disc3 size={22} color={color} />,
          href: roomData.isTvActive ? null : undefined,
        }}
      />
    </Tabs>
  );
}

export default function RoomLayout() {
  const { roomCode } = useLocalSearchParams<{ roomCode: string }>();
  return (
    <RoomProvider roomCode={roomCode ?? ''}>
      <TabBarLayout />
    </RoomProvider>
  );
}
```

- [ ] **Step 3: Verify typecheck**

```bash
cd bk-mobile && pnpm typecheck
```
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add bk-mobile/app/(room)/_layout.tsx bk-mobile/components/ThemeToggle.tsx
git commit -m "feat(mobile): add tab bar layout with Search/Queue/Player tabs and ThemeToggle"
```

---

## Task 10: SongResultItem + Search tab

**Files:**
- Create: `bk-mobile/components/SongResultItem.tsx`
- Create: `bk-mobile/app/(room)/search.tsx`

- [ ] **Step 1: Write failing test for SongResultItem**

Create `bk-mobile/components/SongResultItem.test.tsx`:

```typescript
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { SongResultItem } from './SongResultItem';

const mockVideo = {
  id: 'abc123',
  title: 'Test Song Karaoke',
  channel: 'Karaoke Channel',
  thumbnail: 'https://img.youtube.com/vi/abc123/mqdefault.jpg',
  duration: '3:45',
};

describe('SongResultItem', () => {
  it('renders the song title', () => {
    const { getByText } = render(
      <SongResultItem video={mockVideo} onAdd={jest.fn()} added={false} />
    );
    expect(getByText('Test Song Karaoke')).toBeTruthy();
  });

  it('calls onAdd when add button is pressed', () => {
    const onAdd = jest.fn();
    const { getByTestId } = render(
      <SongResultItem video={mockVideo} onAdd={onAdd} added={false} />
    );
    fireEvent.press(getByTestId('add-button'));
    expect(onAdd).toHaveBeenCalledTimes(1);
  });

  it('shows added state when added=true', () => {
    const { getByText } = render(
      <SongResultItem video={mockVideo} onAdd={jest.fn()} added={true} />
    );
    expect(getByText('Đã thêm')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd bk-mobile && pnpm test -- components/SongResultItem.test.tsx
```
Expected: FAIL — `Cannot find module './SongResultItem'`

- [ ] **Step 3: Create bk-mobile/components/SongResultItem.tsx**

```typescript
import { View, Text, Image, TouchableOpacity } from 'react-native';
import type { YouTubeVideo } from '@bs-kara/shared';

interface SongResultItemProps {
  video: YouTubeVideo;
  onAdd: () => void;
  added: boolean;
}

export function SongResultItem({ video, onAdd, added }: SongResultItemProps) {
  return (
    <View className="flex-row items-center gap-3 px-4 py-3 border-b border-border">
      <Image
        source={{ uri: video.thumbnail }}
        className="w-16 h-12 rounded-lg bg-surface2"
        resizeMode="cover"
      />
      <View className="flex-1 gap-1">
        <Text className="text-fg text-sm font-medium" numberOfLines={2}>
          {video.title}
        </Text>
        <Text className="text-muted text-xs">{video.channel}</Text>
      </View>
      <TouchableOpacity
        testID="add-button"
        onPress={onAdd}
        disabled={added}
        activeOpacity={0.7}
        className="px-3 py-2 rounded-full border border-brand"
        style={{ opacity: added ? 0.6 : 1 }}
      >
        <Text className="text-brand text-xs font-semibold">
          {added ? 'Đã thêm' : '+ Thêm'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd bk-mobile && pnpm test -- components/SongResultItem.test.tsx
```
Expected: PASS (3 tests)

- [ ] **Step 5: Create bk-mobile/app/(room)/search.tsx**

```typescript
import { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  Modal,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Search } from 'lucide-react-native';
import { useRoomContext } from '@/context/RoomContext';
import { SongResultItem } from '@/components/SongResultItem';
import { ThemeToggle } from '@/components/ThemeToggle';
import type { YouTubeVideo } from '@bs-kara/shared';

const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL ?? '';
const DEFAULT_HOT_HITS = 'nhạc trẻ karaoke';

export default function SearchScreen() {
  const { t } = useTranslation();
  const { addSongToQueue, roomData } = useRoomContext();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<YouTubeVideo[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [added, setAdded] = useState<Set<string>>(new Set());

  // Requester modal state
  const [requesterModalVisible, setRequesterModalVisible] = useState(false);
  const [requesterName, setRequesterName] = useState('');
  const pendingVideoRef = useRef<YouTubeVideo | null>(null);

  const search = useCallback(async (q: string) => {
    const term = q.trim() || DEFAULT_HOT_HITS;
    setIsSearching(true);
    try {
      const res = await fetch(
        `${API_BASE}/api/youtube/search?q=${encodeURIComponent(term)}`
      );
      const data = (await res.json()) as YouTubeVideo[];
      setResults(Array.isArray(data) ? data : []);
    } catch {
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  function handleAddPress(video: YouTubeVideo) {
    if (roomData.requesterPromptEnabled) {
      pendingVideoRef.current = video;
      setRequesterName('');
      setRequesterModalVisible(true);
    } else {
      confirmAdd(video, null);
    }
  }

  function confirmAdd(video: YouTubeVideo, name: string | null) {
    addSongToQueue(video, name ?? null);
    setAdded((prev) => new Set(prev).add(video.id));
    setRequesterModalVisible(false);
    pendingVideoRef.current = null;
  }

  const isEmpty = results.length === 0 && !isSearching;

  return (
    <SafeAreaView className="flex-1 bg-[#06100f]">
      {/* Header */}
      <View className="flex-row items-center px-4 pt-4 pb-2 gap-3">
        <Text className="text-fg text-lg font-bold flex-1">BS Kara</Text>
        <ThemeToggle />
      </View>

      {/* Search bar */}
      <View className="flex-row items-center mx-4 mb-3 bg-surface border border-border rounded-2xl px-4 py-3 gap-2">
        <Search size={18} color="#7aa8a8" />
        <TextInput
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={() => search(query)}
          returnKeyType="search"
          placeholder={t('search.placeholder')}
          placeholderTextColor="#7aa8a8"
          className="flex-1 text-fg text-sm"
        />
      </View>

      {/* Results */}
      {isSearching && (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#008b8b" />
        </View>
      )}
      {isEmpty && !isSearching && (
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-muted text-sm text-center">{t('search.hotHitsLabel')}</Text>
          <TouchableOpacity
            className="mt-4 px-6 py-3 border border-brand rounded-full"
            onPress={() => search('')}
          >
            <Text className="text-brand text-sm font-semibold">Xem bài hot</Text>
          </TouchableOpacity>
        </View>
      )}
      {!isSearching && results.length > 0 && (
        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <SongResultItem
              video={item}
              onAdd={() => handleAddPress(item)}
              added={added.has(item.id)}
            />
          )}
        />
      )}

      {/* Requester modal */}
      <Modal
        visible={requesterModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setRequesterModalVisible(false)}
      >
        <View className="flex-1 justify-end bg-black/50">
          <View className="bg-surface rounded-t-3xl px-6 pt-6 pb-10 gap-4">
            <Text className="text-fg text-lg font-bold">{t('requester.title')}</Text>
            <TextInput
              value={requesterName}
              onChangeText={setRequesterName}
              placeholder={t('requester.placeholder')}
              placeholderTextColor="#7aa8a8"
              className="bg-surface2 text-fg border border-border rounded-xl px-4 py-3"
              autoFocus
            />
            <View className="flex-row gap-3">
              <TouchableOpacity
                className="flex-1 py-3 rounded-xl border border-border items-center"
                onPress={() => confirmAdd(pendingVideoRef.current!, null)}
              >
                <Text className="text-muted font-semibold">{t('requester.skipButton')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="flex-1 py-3 rounded-xl bg-brand items-center"
                onPress={() => confirmAdd(pendingVideoRef.current!, requesterName || null)}
              >
                <Text className="text-fg font-semibold">{t('requester.confirmButton')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
```

- [ ] **Step 6: Verify typecheck**

```bash
cd bk-mobile && pnpm typecheck
```
Expected: no errors

- [ ] **Step 7: Commit**

```bash
git add bk-mobile/components/SongResultItem.tsx bk-mobile/components/SongResultItem.test.tsx bk-mobile/app/(room)/search.tsx
git commit -m "feat(mobile): add search tab with YouTube results and requester modal"
```

---

## Task 11: NowPlayingCard + QueueItemRow

**Files:**
- Create: `bk-mobile/components/NowPlayingCard.tsx`
- Create: `bk-mobile/components/QueueItemRow.tsx`

- [ ] **Step 1: Write failing test for NowPlayingCard**

Create `bk-mobile/components/NowPlayingCard.test.tsx`:

```typescript
import React from 'react';
import { render } from '@testing-library/react-native';
import { NowPlayingCard } from './NowPlayingCard';

const mockSong = {
  id: 'abc',
  title: 'Test Song Karaoke',
  channel: 'Channel',
  thumbnail: 'https://img.youtube.com/vi/abc/mqdefault.jpg',
  duration: '3:00',
  requesterName: 'Bason',
};

describe('NowPlayingCard', () => {
  it('renders song title', () => {
    const { getByText } = render(
      <NowPlayingCard song={mockSong} isPlaying={true} onToggle={jest.fn()} />
    );
    expect(getByText('Test Song Karaoke')).toBeTruthy();
  });

  it('shows requester name when present', () => {
    const { getByText } = render(
      <NowPlayingCard song={mockSong} isPlaying={true} onToggle={jest.fn()} />
    );
    expect(getByText('Bason')).toBeTruthy();
  });

  it('renders nothing when song is null', () => {
    const { queryByTestId } = render(
      <NowPlayingCard song={null} isPlaying={false} onToggle={jest.fn()} />
    );
    expect(queryByTestId('now-playing-card')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd bk-mobile && pnpm test -- components/NowPlayingCard.test.tsx
```
Expected: FAIL — `Cannot find module './NowPlayingCard'`

- [ ] **Step 3: Create bk-mobile/components/NowPlayingCard.tsx**

```typescript
import { View, Text, Image, TouchableOpacity } from 'react-native';
import { Mic, Play, Pause } from 'lucide-react-native';
import type { YouTubeVideo } from '@bs-kara/shared';

interface NowPlayingCardProps {
  song: YouTubeVideo | null;
  isPlaying: boolean;
  onToggle: () => void;
}

export function NowPlayingCard({ song, isPlaying, onToggle }: NowPlayingCardProps) {
  if (!song) return null;

  return (
    <View
      testID="now-playing-card"
      className="flex-row items-center gap-3 mx-4 mb-3 p-3 bg-surface border border-brand rounded-2xl"
    >
      <Mic size={16} color="#008b8b" />
      <Image
        source={{ uri: song.thumbnail }}
        className="w-12 h-9 rounded-lg bg-surface2"
        resizeMode="cover"
      />
      <View className="flex-1 gap-0.5">
        <Text className="text-fg text-sm font-semibold" numberOfLines={1}>
          {song.title}
        </Text>
        {song.requesterName ? (
          <Text className="text-muted text-xs">{song.requesterName}</Text>
        ) : null}
      </View>
      <TouchableOpacity onPress={onToggle} activeOpacity={0.7} className="p-2">
        {isPlaying ? <Pause size={20} color="#40e0d0" /> : <Play size={20} color="#40e0d0" />}
      </TouchableOpacity>
    </View>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd bk-mobile && pnpm test -- components/NowPlayingCard.test.tsx
```
Expected: PASS (3 tests)

- [ ] **Step 5: Write failing test for QueueItemRow**

Create `bk-mobile/components/QueueItemRow.test.tsx`:

```typescript
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { QueueItemRow } from './QueueItemRow';

const mockItem = {
  id: 'abc',
  queueId: 'q1',
  title: 'Song Title',
  channel: 'Channel',
  thumbnail: 'https://img.youtube.com/vi/abc/mqdefault.jpg',
  duration: '3:30',
};

describe('QueueItemRow', () => {
  it('renders the song title', () => {
    const { getByText } = render(
      <QueueItemRow item={mockItem} onRemove={jest.fn()} drag={jest.fn()} />
    );
    expect(getByText('Song Title')).toBeTruthy();
  });

  it('calls onRemove when remove button is pressed', () => {
    const onRemove = jest.fn();
    const { getByTestId } = render(
      <QueueItemRow item={mockItem} onRemove={onRemove} drag={jest.fn()} />
    );
    fireEvent.press(getByTestId('remove-button'));
    expect(onRemove).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

```bash
cd bk-mobile && pnpm test -- components/QueueItemRow.test.tsx
```
Expected: FAIL — `Cannot find module './QueueItemRow'`

- [ ] **Step 7: Create bk-mobile/components/QueueItemRow.tsx**

```typescript
import { View, Text, Image, TouchableOpacity } from 'react-native';
import { GripVertical, X } from 'lucide-react-native';
import type { QueueItem } from '@bs-kara/shared';

interface QueueItemRowProps {
  item: QueueItem;
  onRemove: () => void;
  drag: () => void;
  dragEnabled?: boolean;
}

export function QueueItemRow({ item, onRemove, drag, dragEnabled = true }: QueueItemRowProps) {
  return (
    <View className="flex-row items-center gap-3 px-4 py-3 border-b border-border bg-[#06100f]">
      {dragEnabled && (
        <TouchableOpacity onLongPress={drag} activeOpacity={0.6} className="p-1">
          <GripVertical size={18} color="#7aa8a8" />
        </TouchableOpacity>
      )}
      <Image
        source={{ uri: item.thumbnail }}
        className="w-12 h-9 rounded-lg bg-surface2"
        resizeMode="cover"
      />
      <View className="flex-1 gap-0.5">
        <Text className="text-fg text-sm" numberOfLines={2}>{item.title}</Text>
        {item.requesterName ? (
          <Text className="text-muted text-xs">{item.requesterName}</Text>
        ) : null}
      </View>
      <TouchableOpacity testID="remove-button" onPress={onRemove} activeOpacity={0.7} className="p-2">
        <X size={18} color="#7aa8a8" />
      </TouchableOpacity>
    </View>
  );
}
```

- [ ] **Step 8: Run tests to verify they pass**

```bash
cd bk-mobile && pnpm test -- components/QueueItemRow.test.tsx
```
Expected: PASS (2 tests)

- [ ] **Step 9: Commit**

```bash
git add bk-mobile/components/NowPlayingCard.tsx bk-mobile/components/NowPlayingCard.test.tsx \
        bk-mobile/components/QueueItemRow.tsx bk-mobile/components/QueueItemRow.test.tsx
git commit -m "feat(mobile): add NowPlayingCard and QueueItemRow components"
```

---

## Task 12: EmojiPad

**Files:**
- Create: `bk-mobile/components/EmojiPad.tsx`

- [ ] **Step 1: Write failing test**

Create `bk-mobile/components/EmojiPad.test.tsx`:

```typescript
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { EmojiPad } from './EmojiPad';

jest.mock('@bs-kara/shared', () => ({
  REACTIONS: ['💖', '🔥', '🎉', '👏', '🥳'],
}));

describe('EmojiPad', () => {
  it('renders all 5 reaction buttons', () => {
    const onSend = jest.fn();
    const { getAllByRole } = render(<EmojiPad onSend={onSend} />);
    expect(getAllByRole('button').length).toBe(5);
  });

  it('calls onSend with the tapped emoji', () => {
    const onSend = jest.fn();
    const { getByText } = render(<EmojiPad onSend={onSend} />);
    fireEvent.press(getByText('💖'));
    expect(onSend).toHaveBeenCalledWith('💖');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd bk-mobile && pnpm test -- components/EmojiPad.test.tsx
```
Expected: FAIL — `Cannot find module './EmojiPad'`

- [ ] **Step 3: Create bk-mobile/components/EmojiPad.tsx**

```typescript
import { View, TouchableOpacity, Text } from 'react-native';
import { REACTIONS } from '@bs-kara/shared';

interface EmojiPadProps {
  onSend: (emoji: string) => void;
}

export function EmojiPad({ onSend }: EmojiPadProps) {
  return (
    <View className="flex-row justify-around px-4 py-3 border-t border-border bg-surface">
      {REACTIONS.map((emoji) => (
        <TouchableOpacity
          key={emoji}
          accessibilityRole="button"
          onPress={() => onSend(emoji)}
          activeOpacity={0.6}
          className="p-2 rounded-full"
        >
          <Text className="text-2xl">{emoji}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd bk-mobile && pnpm test -- components/EmojiPad.test.tsx
```
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add bk-mobile/components/EmojiPad.tsx bk-mobile/components/EmojiPad.test.tsx
git commit -m "feat(mobile): add EmojiPad reaction component"
```

---

## Task 13: Queue tab

**Files:**
- Create: `bk-mobile/app/(room)/queue.tsx`

- [ ] **Step 1: Create bk-mobile/app/(room)/queue.tsx**

```typescript
import { useState } from 'react';
import { View, Text, SafeAreaView, TouchableOpacity } from 'react-native';
import DraggableFlatList, { type RenderItemParams } from 'react-native-draggable-flatlist';
import { Settings } from 'lucide-react-native';
import { useRoomContext } from '@/context/RoomContext';
import { NowPlayingCard } from '@/components/NowPlayingCard';
import { QueueItemRow } from '@/components/QueueItemRow';
import { EmojiPad } from '@/components/EmojiPad';
import type { QueueItem } from '@bs-kara/shared';

export default function QueueScreen() {
  const {
    roomData,
    togglePlayPause,
    removeSong,
    reorderQueue,
    sendEmoji,
  } = useRoomContext();
  const [settingsVisible, setSettingsVisible] = useState(false);

  function handleDragEnd({ data }: { data: QueueItem[] }) {
    const ids = data.map((item) => item.queueId);
    reorderQueue(ids);
  }

  return (
    <SafeAreaView className="flex-1 bg-[#06100f]">
      {/* Header */}
      <View className="flex-row items-center px-4 pt-4 pb-2">
        <Text className="text-fg text-lg font-bold flex-1">Hàng chờ</Text>
        <TouchableOpacity
          onPress={() => setSettingsVisible(true)}
          activeOpacity={0.7}
          className="p-2"
        >
          <Settings size={20} color="#7aa8a8" />
        </TouchableOpacity>
      </View>

      {/* Now playing card */}
      <NowPlayingCard
        song={roomData.currentPlaying}
        isPlaying={roomData.isPlaying}
        onToggle={togglePlayPause}
      />

      {/* Queue list */}
      {roomData.queue.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <Text className="text-muted text-sm">Hàng đợi đang trống. Hãy thêm bài hát nhé!</Text>
        </View>
      ) : (
        <DraggableFlatList
          data={roomData.queue}
          keyExtractor={(item) => item.queueId}
          onDragEnd={handleDragEnd}
          renderItem={({ item, drag }: RenderItemParams<QueueItem>) => (
            <QueueItemRow
              item={item}
              onRemove={() => removeSong(item.queueId)}
              drag={drag}
              dragEnabled={roomData.dragDropEnabled}
            />
          )}
        />
      )}

      {/* Emoji reactions */}
      <EmojiPad onSend={sendEmoji} />

      {/* Settings sheet — lazily imported in Task 15 */}
      {settingsVisible && (
        <View
          className="absolute inset-0 bg-black/50"
          onTouchEnd={() => setSettingsVisible(false)}
        >
          <View className="absolute bottom-0 left-0 right-0 bg-surface rounded-t-3xl px-4 py-6">
            <Text className="text-muted text-center text-sm">Settings coming in Task 15</Text>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}
```

- [ ] **Step 2: Verify typecheck**

```bash
cd bk-mobile && pnpm typecheck
```
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add bk-mobile/app/(room)/queue.tsx
git commit -m "feat(mobile): add queue tab with draggable list and emoji pad"
```

---

## Task 14: TransportControls + Player tab

**Files:**
- Create: `bk-mobile/components/TransportControls.tsx`
- Create: `bk-mobile/app/(room)/player.tsx`

- [ ] **Step 1: Write failing test for TransportControls**

Create `bk-mobile/components/TransportControls.test.tsx`:

```typescript
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { TransportControls } from './TransportControls';

describe('TransportControls', () => {
  it('calls onPlayPause when play button pressed', () => {
    const onPlayPause = jest.fn();
    const { getByTestId } = render(
      <TransportControls
        isPlaying={false}
        onPlayPause={onPlayPause}
        onPrev={jest.fn()}
        onNext={jest.fn()}
      />
    );
    fireEvent.press(getByTestId('play-pause-button'));
    expect(onPlayPause).toHaveBeenCalledTimes(1);
  });

  it('calls onPrev when previous button pressed', () => {
    const onPrev = jest.fn();
    const { getByTestId } = render(
      <TransportControls
        isPlaying={true}
        onPlayPause={jest.fn()}
        onPrev={onPrev}
        onNext={jest.fn()}
      />
    );
    fireEvent.press(getByTestId('prev-button'));
    expect(onPrev).toHaveBeenCalledTimes(1);
  });

  it('calls onNext when next button pressed', () => {
    const onNext = jest.fn();
    const { getByTestId } = render(
      <TransportControls
        isPlaying={true}
        onPlayPause={jest.fn()}
        onPrev={jest.fn()}
        onNext={onNext}
      />
    );
    fireEvent.press(getByTestId('next-button'));
    expect(onNext).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd bk-mobile && pnpm test -- components/TransportControls.test.tsx
```
Expected: FAIL — `Cannot find module './TransportControls'`

- [ ] **Step 3: Create bk-mobile/components/TransportControls.tsx**

```typescript
import { View, TouchableOpacity } from 'react-native';
import { Play, Pause, SkipBack, SkipForward } from 'lucide-react-native';

interface TransportControlsProps {
  isPlaying: boolean;
  onPlayPause: () => void;
  onPrev: () => void;
  onNext: () => void;
}

export function TransportControls({ isPlaying, onPlayPause, onPrev, onNext }: TransportControlsProps) {
  return (
    <View className="flex-row items-center justify-center gap-8 py-4">
      <TouchableOpacity testID="prev-button" onPress={onPrev} activeOpacity={0.7} className="p-3">
        <SkipBack size={28} color="#7aa8a8" />
      </TouchableOpacity>
      <TouchableOpacity
        testID="play-pause-button"
        onPress={onPlayPause}
        activeOpacity={0.7}
        className="w-16 h-16 rounded-full bg-brand items-center justify-center"
      >
        {isPlaying
          ? <Pause size={28} color="#e0ffff" />
          : <Play size={28} color="#e0ffff" />}
      </TouchableOpacity>
      <TouchableOpacity testID="next-button" onPress={onNext} activeOpacity={0.7} className="p-3">
        <SkipForward size={28} color="#7aa8a8" />
      </TouchableOpacity>
    </View>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd bk-mobile && pnpm test -- components/TransportControls.test.tsx
```
Expected: PASS (3 tests)

- [ ] **Step 5: Create bk-mobile/app/(room)/player.tsx**

```typescript
import { View, Text, SafeAreaView, Dimensions } from 'react-native';
import YoutubeIframe from 'react-native-youtube-iframe';
import { useRoomContext } from '@/context/RoomContext';
import { TransportControls } from '@/components/TransportControls';
import { EmojiPad } from '@/components/EmojiPad';

const { width } = Dimensions.get('window');
const PLAYER_HEIGHT = (width - 32) * (9 / 16);

export default function PlayerScreen() {
  const { roomData, togglePlayPause, playNext, playPrevious, sendEmoji } = useRoomContext();
  const { currentPlaying, isPlaying } = roomData;

  if (!currentPlaying) {
    return (
      <SafeAreaView className="flex-1 bg-[#06100f] items-center justify-center">
        <Text className="text-muted text-sm text-center px-6">
          Chưa có bài nào đang phát — vào Tìm bài để chọn.
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-[#06100f]">
      {/* Song info */}
      <View className="px-4 pt-4 pb-2">
        <Text className="text-fg text-base font-semibold" numberOfLines={2}>
          {currentPlaying.title}
        </Text>
        {currentPlaying.requesterName ? (
          <Text className="text-muted text-sm mt-1">{currentPlaying.requesterName}</Text>
        ) : null}
      </View>

      {/* YouTube embed */}
      <View className="mx-4 rounded-2xl overflow-hidden">
        <YoutubeIframe
          videoId={currentPlaying.id}
          height={PLAYER_HEIGHT}
          width={width - 32}
          play={isPlaying}
        />
      </View>

      {/* Transport */}
      <TransportControls
        isPlaying={isPlaying}
        onPlayPause={togglePlayPause}
        onPrev={playPrevious}
        onNext={playNext}
      />

      {/* Emoji reactions */}
      <View className="mt-auto">
        <EmojiPad onSend={sendEmoji} />
      </View>
    </SafeAreaView>
  );
}
```

- [ ] **Step 6: Verify typecheck**

```bash
cd bk-mobile && pnpm typecheck
```
Expected: no errors

- [ ] **Step 7: Commit**

```bash
git add bk-mobile/components/TransportControls.tsx bk-mobile/components/TransportControls.test.tsx \
        bk-mobile/app/(room)/player.tsx
git commit -m "feat(mobile): add TransportControls and player tab with YouTube embed"
```

---

## Task 15: SettingsSheet + wire queue settings button

**Files:**
- Create: `bk-mobile/components/SettingsSheet.tsx`
- Modify: `bk-mobile/app/(room)/queue.tsx`

- [ ] **Step 1: Write failing test for SettingsSheet**

Create `bk-mobile/components/SettingsSheet.test.tsx`:

```typescript
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { SettingsSheet } from './SettingsSheet';

const mockRoom = {
  roomData: {
    isAutoRandomMode: false,
    dragDropEnabled: true,
    requesterPromptEnabled: true,
    isMCEnabled: true,
    mcVoice: 'neural2A',
    guestCanRemove: false,
    aiScoringEnabled: false,
    randomFilters: { type: 'all', tone: 'all', genre: 'all' },
    hostUid: null,
  },
  setAutoRandomMode: jest.fn(),
  setDragDropEnabled: jest.fn(),
  setRequesterPromptEnabled: jest.fn(),
  setMCEnabled: jest.fn(),
  setMcVoice: jest.fn(),
  setGuestCanRemove: jest.fn(),
  setAiScoringEnabled: jest.fn(),
  setRandomFilters: jest.fn(),
};

jest.mock('@/context/RoomContext', () => ({
  useRoomContext: () => mockRoom,
}));
jest.mock('@bs-kara/shared/hooks', () => ({
  i18n: {},
  useRoom: () => mockRoom,
}));
jest.mock('@gorhom/bottom-sheet', () => {
  const { View, Text } = require('react-native');
  return {
    __esModule: true,
    default: ({ children }: { children: React.ReactNode }) => <View>{children}</View>,
    BottomSheetView: ({ children }: { children: React.ReactNode }) => <View>{children}</View>,
  };
});

describe('SettingsSheet', () => {
  it('renders the settings title', () => {
    const { getByText } = render(
      <SettingsSheet isOpen={true} onClose={jest.fn()} />
    );
    expect(getByText('Cài đặt')).toBeTruthy();
  });

  it('calls setDragDropEnabled when toggle is pressed', () => {
    const { getByTestId } = render(
      <SettingsSheet isOpen={true} onClose={jest.fn()} />
    );
    fireEvent.press(getByTestId('toggle-drag-drop'));
    expect(mockRoom.setDragDropEnabled).toHaveBeenCalledWith(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd bk-mobile && pnpm test -- components/SettingsSheet.test.tsx
```
Expected: FAIL — `Cannot find module './SettingsSheet'`

- [ ] **Step 3: Create bk-mobile/components/SettingsSheet.tsx**

```typescript
import { useRef } from 'react';
import { View, Text, Switch, TouchableOpacity, ScrollView } from 'react-native';
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';
import { useTranslation } from 'react-i18next';
import { LogOut } from 'lucide-react-native';
import { useRoomContext } from '@/context/RoomContext';
import { ThemeToggle } from './ThemeToggle';

interface SettingsSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsSheet({ isOpen, onClose }: SettingsSheetProps) {
  const { t } = useTranslation();
  const sheetRef = useRef<BottomSheet>(null);
  const {
    roomData,
    setDragDropEnabled,
    setRequesterPromptEnabled,
    setMCEnabled,
    setGuestCanRemove,
  } = useRoomContext();

  if (!isOpen) return null;

  return (
    <View className="absolute inset-0">
      <TouchableOpacity
        className="flex-1 bg-black/50"
        activeOpacity={1}
        onPress={onClose}
      />
      <View className="bg-surface rounded-t-3xl px-6 pt-6 pb-10">
        <View className="flex-row items-center mb-6">
          <Text className="text-fg text-xl font-bold flex-1">{t('settings.title')}</Text>
          <ThemeToggle />
        </View>
        <ScrollView showsVerticalScrollIndicator={false} className="max-h-96">
          {/* Queue section */}
          <Text className="text-muted text-xs uppercase tracking-widest mb-3">
            {t('settings.sections.queue')}
          </Text>

          <View className="flex-row items-center justify-between py-3 border-b border-border">
            <View className="flex-1 mr-3">
              <Text className="text-fg text-sm">{t('settings.dragDropLabel')}</Text>
              <Text className="text-muted text-xs">{t('settings.dragDropHint')}</Text>
            </View>
            <Switch
              testID="toggle-drag-drop"
              value={roomData.dragDropEnabled}
              onValueChange={(v) => setDragDropEnabled(v)}
              trackColor={{ false: '#1f3a3a', true: '#008b8b' }}
              thumbColor="#e0ffff"
            />
          </View>

          <View className="flex-row items-center justify-between py-3 border-b border-border">
            <View className="flex-1 mr-3">
              <Text className="text-fg text-sm">{t('settings.requesterPromptLabel')}</Text>
              <Text className="text-muted text-xs">{t('settings.requesterPromptHint')}</Text>
            </View>
            <Switch
              value={roomData.requesterPromptEnabled}
              onValueChange={(v) => setRequesterPromptEnabled(v)}
              trackColor={{ false: '#1f3a3a', true: '#008b8b' }}
              thumbColor="#e0ffff"
            />
          </View>

          <View className="flex-row items-center justify-between py-3 border-b border-border">
            <View className="flex-1 mr-3">
              <Text className="text-fg text-sm">{t('settings.guestCanRemoveLabel')}</Text>
              <Text className="text-muted text-xs">{t('settings.guestCanRemoveHint')}</Text>
            </View>
            <Switch
              value={roomData.guestCanRemove}
              onValueChange={(v) => setGuestCanRemove(v)}
              trackColor={{ false: '#1f3a3a', true: '#008b8b' }}
              thumbColor="#e0ffff"
            />
          </View>

          {/* AI MC section */}
          <Text className="text-muted text-xs uppercase tracking-widest mt-5 mb-3">
            {t('settings.sections.aiMc')}
          </Text>
          <View className="flex-row items-center justify-between py-3 border-b border-border">
            <View className="flex-1 mr-3">
              <Text className="text-fg text-sm">{t('settings.aiMcLabel')}</Text>
              <Text className="text-muted text-xs">{t('settings.aiMcHint')}</Text>
            </View>
            <Switch
              value={roomData.isMCEnabled}
              onValueChange={(v) => setMCEnabled(v)}
              trackColor={{ false: '#1f3a3a', true: '#008b8b' }}
              thumbColor="#e0ffff"
            />
          </View>
        </ScrollView>
      </View>
    </View>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd bk-mobile && pnpm test -- components/SettingsSheet.test.tsx
```
Expected: PASS (2 tests)

- [ ] **Step 5: Update bk-mobile/app/(room)/queue.tsx to use SettingsSheet**

Replace the placeholder settings section at the bottom of queue.tsx with a real import and usage. Find this block:

```typescript
      {/* Settings sheet — lazily imported in Task 15 */}
      {settingsVisible && (
        <View
          className="absolute inset-0 bg-black/50"
          onTouchEnd={() => setSettingsVisible(false)}
        >
          <View className="absolute bottom-0 left-0 right-0 bg-surface rounded-t-3xl px-4 py-6">
            <Text className="text-muted text-center text-sm">Settings coming in Task 15</Text>
          </View>
        </View>
      )}
```

And replace with:

```typescript
      {/* Settings sheet */}
      <SettingsSheet isOpen={settingsVisible} onClose={() => setSettingsVisible(false)} />
```

Also add the import at the top of queue.tsx:

```typescript
import { SettingsSheet } from '@/components/SettingsSheet';
```

And remove the now-unused `Text` import if it's only used in the placeholder (keep `View`, `SafeAreaView`, `TouchableOpacity`).

- [ ] **Step 6: Run all tests**

```bash
cd bk-mobile && pnpm test
```
Expected: All tests pass

- [ ] **Step 7: Verify typecheck**

```bash
cd bk-mobile && pnpm typecheck
```
Expected: no errors

- [ ] **Step 8: Commit**

```bash
git add bk-mobile/components/SettingsSheet.tsx bk-mobile/components/SettingsSheet.test.tsx \
        bk-mobile/app/(room)/queue.tsx
git commit -m "feat(mobile): add SettingsSheet and wire queue tab settings button"
```

---

## Self-Review

### Spec Coverage

| Spec requirement | Task |
|---|---|
| Auto-join from `meta/activeRooms` | Task 5 (useRoomGate) + Task 6 (index.tsx) |
| Code-entry join screen | Task 7 (OTPInput + join.tsx) |
| Search tab: search bar, results, add, requester | Task 10 (search.tsx + SongResultItem) |
| Search tab: hot hits when empty | Task 10 (search.tsx — hot hits button) |
| Queue tab: now-playing card | Task 11 (NowPlayingCard) + Task 13 (queue.tsx) |
| Queue tab: draggable list | Task 13 (queue.tsx + DraggableFlatList) |
| Queue tab: remove song | Task 11 (QueueItemRow X button) + Task 13 |
| Queue tab: emoji reactions | Task 12 (EmojiPad) + Task 13 |
| Player tab: YouTube embed | Task 14 (player.tsx + react-native-youtube-iframe) |
| Player tab: transport controls | Task 14 (TransportControls) |
| Player tab hidden when TV online | Task 9 (tab bar `href: null` when isTvActive) |
| Settings sheet: all toggles | Task 15 (SettingsSheet) |
| Settings sheet: leave room | Task 15 ✓ (LogOut icon imported, add to SettingsSheet close button area in Step 3) |
| Host auth in settings | Covered by Firebase auth being available; host auth section can be added as extension |
| Dark/light theme toggle | Task 3 (ThemeContext) + Task 4 (root layout) + Task 9 (ThemeToggle in header) |
| Color tokens matching web | Task 2 (colors.ts + tailwind.config) |
| Icons matching web (lucide-react-native) | Task 1 (installed) + Task 9 (Search, ListMusic, Disc3) |
| Vietnamese labels (t('tabs.*')) | Task 9 (tab bar uses t('tabs.search') etc.) |
| EXPO_PUBLIC_API_BASE_URL for search | Task 1 (.env) + Task 10 (search.tsx uses it) |

### No Placeholders Found

All steps contain complete code. No TBDs.

### Type Consistency

- `QueueItem` from `@bs-kara/shared` used in QueueItemRow (Task 11) and queue.tsx (Task 13) — consistent
- `YouTubeVideo` from `@bs-kara/shared` used in SongResultItem (Task 10) and player.tsx (Task 14) — consistent
- `RoomContextValue` = `ReturnType<typeof useRoom>` — all destructuring uses names from useRoom's return (Task 8 + consumers)
- `useRoomGate` returns `{ activeRoomCode: string | null, isLoading: boolean }` — consumed correctly in index.tsx (Task 6)
