# Mobile Settings UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a theme section (light/system/dark) to the bk-mobile settings screen, extract shared section components to eliminate duplication, and wire all settings colours to theme tokens.

**Architecture:** `ThemeContext` gains a `'system'` option and exposes `resolvedTheme` (always `'light'|'dark'`). Shared section primitives and section components move to `bk-mobile/features/settings/`, reading colours from `constants/colors.ts` tokens via `useTheme()`. Both `settings.tsx` and `SettingsSheet.tsx` become thin composition shells.

**Tech Stack:** React Native, Expo, nativewind, expo-linear-gradient, @react-native-async-storage/async-storage, jest-expo, @testing-library/react-native

---

## Task 1: Upgrade ThemeContext — add `system` + `resolvedTheme`

**Files:**
- Modify: `bk-mobile/context/ThemeContext.tsx`
- Modify: `bk-mobile/context/ThemeContext.test.tsx`

- [ ] **Step 1: Replace test file with failing tests for the new API**

```tsx
// bk-mobile/context/ThemeContext.test.tsx
import React from 'react';
import { render, act } from '@testing-library/react-native';
import { Text, useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ThemeProvider, useTheme } from './ThemeContext';
import type { Theme } from './ThemeContext';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
jest.mock('nativewind', () => ({
  useColorScheme: () => ({ setColorScheme: jest.fn() }),
}));
jest.mock('react-native', () => ({
  ...jest.requireActual('react-native'),
  useColorScheme: jest.fn().mockReturnValue('dark'),
}));

const mockedOSScheme = useColorScheme as jest.MockedFunction<typeof useColorScheme>;

function ResolvedDisplay() {
  const { resolvedTheme } = useTheme();
  return <Text testID="resolved">{resolvedTheme}</Text>;
}
function PrefDisplay() {
  const { preference } = useTheme();
  return <Text testID="pref">{preference}</Text>;
}

describe('ThemeContext', () => {
  beforeEach(() => {
    mockedOSScheme.mockReturnValue('dark');
    jest.clearAllMocks();
  });

  it('defaults to system preference', () => {
    const { getByTestId } = render(
      <ThemeProvider><PrefDisplay /></ThemeProvider>
    );
    expect(getByTestId('pref').props.children).toBe('system');
  });

  it('resolvedTheme is dark when preference is dark, regardless of OS', async () => {
    mockedOSScheme.mockReturnValue('light');
    let setter!: (p: Theme) => void;
    function Grabber() {
      const ctx = useTheme();
      setter = ctx.setPreference;
      return <Text testID="resolved">{ctx.resolvedTheme}</Text>;
    }
    const { getByTestId } = render(<ThemeProvider><Grabber /></ThemeProvider>);
    await act(async () => { setter('dark'); });
    expect(getByTestId('resolved').props.children).toBe('dark');
  });

  it('resolvedTheme is light when preference is light, regardless of OS', async () => {
    mockedOSScheme.mockReturnValue('dark');
    let setter!: (p: Theme) => void;
    function Grabber() {
      const ctx = useTheme();
      setter = ctx.setPreference;
      return <Text testID="resolved">{ctx.resolvedTheme}</Text>;
    }
    const { getByTestId } = render(<ThemeProvider><Grabber /></ThemeProvider>);
    await act(async () => { setter('light'); });
    expect(getByTestId('resolved').props.children).toBe('light');
  });

  it('resolvedTheme follows OS when preference is system', () => {
    mockedOSScheme.mockReturnValue('light');
    const { getByTestId } = render(
      <ThemeProvider><ResolvedDisplay /></ThemeProvider>
    );
    expect(getByTestId('resolved').props.children).toBe('light');
  });

  it('resolvedTheme is never "system" — always light or dark', () => {
    const { getByTestId } = render(
      <ThemeProvider><ResolvedDisplay /></ThemeProvider>
    );
    expect(['light', 'dark']).toContain(getByTestId('resolved').props.children);
  });

  it('setPreference persists to AsyncStorage', async () => {
    let setter!: (p: Theme) => void;
    function Grabber() {
      const ctx = useTheme();
      setter = ctx.setPreference;
      return null;
    }
    render(<ThemeProvider><Grabber /></ThemeProvider>);
    await act(async () => { setter('system'); });
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('karaoke_theme', 'system');
  });
});
```

- [ ] **Step 2: Run the tests — confirm all 6 fail**

```bash
cd bk-mobile && npx jest --testPathPattern="context/ThemeContext" --no-coverage
```

Expected: 6 failures (properties `resolvedTheme`, `preference`, `setPreference` do not exist; `toggleTheme` still in API)

- [ ] **Step 3: Rewrite ThemeContext implementation**

```tsx
// bk-mobile/context/ThemeContext.tsx
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColorScheme as useOSColorScheme } from 'react-native';
import { useColorScheme } from 'nativewind';

export type Theme = 'dark' | 'light' | 'system';
const STORAGE_KEY = 'karaoke_theme';

interface ThemeContextValue {
  preference: Theme;
  resolvedTheme: 'light' | 'dark';
  setPreference: (pref: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  preference: 'system',
  resolvedTheme: 'dark',
  setPreference: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [preference, setPreferenceState] = useState<Theme>('system');
  const osScheme = useOSColorScheme() ?? 'dark';
  const { setColorScheme } = useColorScheme();

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (stored === 'light' || stored === 'dark' || stored === 'system') {
        setPreferenceState(stored);
      }
    });
  }, []);

  const resolvedTheme: 'light' | 'dark' =
    preference === 'system' ? osScheme : preference;

  useEffect(() => {
    setColorScheme(resolvedTheme);
  }, [resolvedTheme, setColorScheme]);

  const setPreference = useCallback((pref: Theme) => {
    setPreferenceState(pref);
    AsyncStorage.setItem(STORAGE_KEY, pref).catch(() => {});
  }, []);

  const value = useMemo(
    () => ({ preference, resolvedTheme, setPreference }),
    [preference, resolvedTheme, setPreference]
  );

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
```

- [ ] **Step 4: Run the tests — confirm all 6 pass**

```bash
cd bk-mobile && npx jest --testPathPattern="context/ThemeContext" --no-coverage
```

Expected: 6 passing

- [ ] **Step 5: Commit**

```bash
cd bk-mobile && git add context/ThemeContext.tsx context/ThemeContext.test.tsx
git commit -m "feat(mobile): upgrade ThemeContext with system option and resolvedTheme"
```

---

## Task 2: Update ThemeToggle to use new API

**Files:**
- Modify: `bk-mobile/components/ThemeToggle.tsx`

The current component calls `toggleTheme()` which no longer exists. Update it to call `setPreference()` cycling `dark → light → system → dark`. The icon reflects the current preference.

- [ ] **Step 1: Update ThemeToggle**

```tsx
// bk-mobile/components/ThemeToggle.tsx
import { TouchableOpacity } from 'react-native';
import { Sun, Moon, Monitor } from 'lucide-react-native';
import { useTheme } from '@/context/ThemeContext';
import type { Theme } from '@/context/ThemeContext';

const NEXT_PREF: Record<Theme, Theme> = { dark: 'light', light: 'system', system: 'dark' };

export function ThemeToggle() {
  const { preference, setPreference } = useTheme();
  const Icon = preference === 'light' ? Sun : preference === 'dark' ? Moon : Monitor;
  return (
    <TouchableOpacity
      onPress={() => setPreference(NEXT_PREF[preference])}
      activeOpacity={0.7}
      className="p-2"
    >
      <Icon size={20} color="#7aa8a8" />
    </TouchableOpacity>
  );
}
```

- [ ] **Step 2: Run the full test suite to confirm no regressions**

```bash
cd bk-mobile && npx jest --no-coverage
```

Expected: all tests pass

- [ ] **Step 3: Commit**

```bash
cd bk-mobile && git add components/ThemeToggle.tsx
git commit -m "feat(mobile): update ThemeToggle to cycle dark/light/system"
```

---

## Task 3: Create shared settings primitives

**Files:**
- Create: `bk-mobile/features/settings/primitives/SectionLabel.tsx`
- Create: `bk-mobile/features/settings/primitives/ToggleRow.tsx`
- Create: `bk-mobile/features/settings/primitives/FilterChipRow.tsx`

These are extracted from both `settings.tsx` and `SettingsSheet.tsx`, updated to use theme tokens and new spacing values (card margin 12px, border-radius 12px, section label padding 14/6px).

- [ ] **Step 1: Create SectionLabel**

```tsx
// bk-mobile/features/settings/primitives/SectionLabel.tsx
import { Text } from 'react-native';
import { useTheme } from '@/context/ThemeContext';
import { DarkColors, LightColors } from '@/constants/colors';

export function SectionLabel({ label }: { label: string }) {
  const { resolvedTheme } = useTheme();
  const c = resolvedTheme === 'dark' ? DarkColors : LightColors;
  return (
    <Text
      style={{
        color: c.muted,
        fontSize: 10,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 2,
        paddingTop: 14,
        paddingBottom: 6,
      }}
    >
      {label}
    </Text>
  );
}
```

- [ ] **Step 2: Create ToggleRow**

```tsx
// bk-mobile/features/settings/primitives/ToggleRow.tsx
import { View, Text, Switch } from 'react-native';
import { useTheme } from '@/context/ThemeContext';
import { DarkColors, LightColors } from '@/constants/colors';

export function ToggleRow({
  label,
  hint,
  value,
  onValueChange,
  testID,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
  testID?: string;
}) {
  const { resolvedTheme } = useTheme();
  const c = resolvedTheme === 'dark' ? DarkColors : LightColors;
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: c.border,
      }}
    >
      <View style={{ flex: 1, marginRight: 12 }}>
        <Text style={{ color: c.fg, fontSize: 14 }}>{label}</Text>
        {hint ? (
          <Text style={{ color: c.muted, fontSize: 12, marginTop: 2 }}>{hint}</Text>
        ) : null}
      </View>
      <Switch
        testID={testID}
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: c.border, true: c.brand }}
        thumbColor={c.fg}
      />
    </View>
  );
}
```

- [ ] **Step 3: Create FilterChipRow**

```tsx
// bk-mobile/features/settings/primitives/FilterChipRow.tsx
import { View, Text, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/context/ThemeContext';
import { DarkColors, LightColors } from '@/constants/colors';

export function FilterChipRow({
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const { resolvedTheme } = useTheme();
  const c = resolvedTheme === 'dark' ? DarkColors : LightColors;
  return (
    <View style={{ marginBottom: 12, opacity: disabled ? 0.4 : 1 }}>
      <Text
        style={{
          color: c.muted,
          fontSize: 11,
          fontWeight: '600',
          textTransform: 'uppercase',
          letterSpacing: 2,
          marginBottom: 8,
        }}
      >
        {label}
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {options.map((opt) => {
          const active = opt.value === value;
          if (active) {
            return (
              <LinearGradient
                key={opt.value}
                colors={[c.gradientStart, c.gradientMid, c.gradientEnd]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{ borderRadius: 999 }}
              >
                <TouchableOpacity
                  onPress={() => !disabled && onChange(opt.value)}
                  activeOpacity={0.8}
                  style={{ paddingHorizontal: 14, paddingVertical: 6 }}
                >
                  <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              </LinearGradient>
            );
          }
          return (
            <TouchableOpacity
              key={opt.value}
              onPress={() => !disabled && onChange(opt.value)}
              activeOpacity={0.7}
              style={{
                backgroundColor: c.surface2,
                borderWidth: 1,
                borderColor: c.border,
                borderRadius: 999,
                paddingHorizontal: 14,
                paddingVertical: 6,
              }}
            >
              <Text style={{ color: c.muted, fontSize: 12 }}>{opt.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}
```

- [ ] **Step 4: Commit**

```bash
cd bk-mobile && git add features/settings/primitives/
git commit -m "feat(mobile): add shared settings primitives with theme token wiring"
```

---

## Task 4: Create AutoRandomSection

**Files:**
- Create: `bk-mobile/features/settings/sections/AutoRandomSection.tsx`

- [ ] **Step 1: Create AutoRandomSection**

```tsx
// bk-mobile/features/settings/sections/AutoRandomSection.tsx
import { View, Text, Switch, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/context/ThemeContext';
import { DarkColors, LightColors } from '@/constants/colors';
import { FilterChipRow } from '../primitives/FilterChipRow';
import { SectionLabel } from '../primitives/SectionLabel';
import type { Genre, SingerType, Tone } from '@bs-kara/shared';

type RandomFilters = { genre: Genre; type: SingerType; tone: Tone };

const TYPE_OPTIONS: { value: SingerType; labelKey: string }[] = [
  { value: 'all', labelKey: 'autoRandom.type.all' },
  { value: 'solo', labelKey: 'autoRandom.type.solo' },
  { value: 'duet', labelKey: 'autoRandom.type.duet' },
];
const TONE_OPTIONS: { value: Tone; labelKey: string }[] = [
  { value: 'all', labelKey: 'autoRandom.tone.all' },
  { value: 'male', labelKey: 'autoRandom.tone.male' },
  { value: 'female', labelKey: 'autoRandom.tone.female' },
];
const GENRE_OPTIONS: { value: Genre; labelKey: string }[] = [
  { value: 'all', labelKey: 'autoRandom.genre.all' },
  { value: 'bolero', labelKey: 'autoRandom.genre.bolero' },
  { value: 'caco', labelKey: 'autoRandom.genre.caco' },
  { value: 'tre', labelKey: 'autoRandom.genre.tre' },
];

interface AutoRandomSectionProps {
  isAutoRandomMode: boolean;
  randomFilters: RandomFilters;
  onAutoRandomChange: (v: boolean) => void;
  onFilterChange: (f: Partial<RandomFilters>) => void;
}

export function AutoRandomSection({
  isAutoRandomMode,
  randomFilters,
  onAutoRandomChange,
  onFilterChange,
}: AutoRandomSectionProps) {
  const { t } = useTranslation();
  const { resolvedTheme } = useTheme();
  const c = resolvedTheme === 'dark' ? DarkColors : LightColors;

  return (
    <>
      <SectionLabel label={t('settings.sections.autoRandom')} />
      <View
        style={{
          backgroundColor: isAutoRandomMode
            ? 'rgba(0,139,139,0.08)'
            : c.surface2,
          borderWidth: 1,
          borderColor: isAutoRandomMode ? 'rgba(0,139,139,0.4)' : c.border,
          borderRadius: 16,
          marginHorizontal: 12,
          marginBottom: 4,
          overflow: 'hidden',
        }}
      >
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => onAutoRandomChange(!isAutoRandomMode)}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 16,
            paddingVertical: 14,
          }}
        >
          <View style={{ flex: 1, marginRight: 12 }}>
            <Text style={{ color: c.fg, fontSize: 14, fontWeight: '600' }}>
              {t('autoRandom.toggleLabel')}
            </Text>
            <Text
              style={{
                color: isAutoRandomMode ? c.accent : c.muted,
                fontSize: 10,
                fontWeight: '600',
                textTransform: 'uppercase',
                letterSpacing: 3,
                marginTop: 4,
              }}
            >
              {isAutoRandomMode ? t('autoRandom.onBadge') : t('autoRandom.offBadge')}
            </Text>
          </View>
          <Switch
            value={isAutoRandomMode}
            onValueChange={onAutoRandomChange}
            trackColor={{ false: c.border, true: c.brand }}
            thumbColor={c.fg}
          />
        </TouchableOpacity>

        {isAutoRandomMode && (
          <View
            style={{
              paddingHorizontal: 16,
              paddingBottom: 16,
              paddingTop: 8,
              borderTopWidth: 1,
              borderTopColor: 'rgba(0,139,139,0.2)',
            }}
          >
            <Text style={{ color: c.muted, fontSize: 12, marginBottom: 16 }}>
              {t('autoRandom.description')}
            </Text>
            <FilterChipRow
              label={t('autoRandom.genreLabel')}
              value={randomFilters.genre}
              options={GENRE_OPTIONS.map((o) => ({ value: o.value, label: t(o.labelKey) }))}
              onChange={(v) => onFilterChange({ genre: v as Genre })}
            />
            <FilterChipRow
              label={t('autoRandom.typeLabel')}
              value={randomFilters.type}
              options={TYPE_OPTIONS.map((o) => ({ value: o.value, label: t(o.labelKey) }))}
              onChange={(v) => {
                const next = v as SingerType;
                if (next === 'duet') onFilterChange({ type: next, tone: 'all' });
                else onFilterChange({ type: next });
              }}
            />
            <FilterChipRow
              label={t('autoRandom.toneLabel')}
              value={randomFilters.tone}
              options={TONE_OPTIONS.map((o) => ({ value: o.value, label: t(o.labelKey) }))}
              onChange={(v) => onFilterChange({ tone: v as Tone })}
              disabled={randomFilters.type === 'duet'}
            />
          </View>
        )}
      </View>
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd bk-mobile && git add features/settings/sections/AutoRandomSection.tsx
git commit -m "feat(mobile): add shared AutoRandomSection"
```

---

## Task 5: Create QueueSection

**Files:**
- Create: `bk-mobile/features/settings/sections/QueueSection.tsx`

- [ ] **Step 1: Create QueueSection**

```tsx
// bk-mobile/features/settings/sections/QueueSection.tsx
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { SectionLabel } from '../primitives/SectionLabel';
import { ToggleRow } from '../primitives/ToggleRow';

interface QueueSectionProps {
  dragDropEnabled: boolean;
  requesterPromptEnabled: boolean;
  guestCanRemove: boolean;
  onDragDropChange: (v: boolean) => void;
  onRequesterPromptChange: (v: boolean) => void;
  onGuestCanRemoveChange: (v: boolean) => void;
}

export function QueueSection({
  dragDropEnabled,
  requesterPromptEnabled,
  guestCanRemove,
  onDragDropChange,
  onRequesterPromptChange,
  onGuestCanRemoveChange,
}: QueueSectionProps) {
  const { t } = useTranslation();
  return (
    <>
      <SectionLabel label={t('settings.sections.queue')} />
      <View style={{ marginHorizontal: 12, marginBottom: 4 }}>
        <ToggleRow
          testID="toggle-drag-drop"
          label={t('settings.dragDropLabel')}
          hint={t('settings.dragDropHint')}
          value={dragDropEnabled}
          onValueChange={onDragDropChange}
        />
        <ToggleRow
          label={t('settings.requesterPromptLabel')}
          hint={t('settings.requesterPromptHint')}
          value={requesterPromptEnabled}
          onValueChange={onRequesterPromptChange}
        />
        <ToggleRow
          label={t('settings.guestCanRemoveLabel')}
          hint={t('settings.guestCanRemoveHint')}
          value={guestCanRemove}
          onValueChange={onGuestCanRemoveChange}
        />
      </View>
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd bk-mobile && git add features/settings/sections/QueueSection.tsx
git commit -m "feat(mobile): add shared QueueSection"
```

---

## Task 6: Create AIMcSection

**Files:**
- Create: `bk-mobile/features/settings/sections/AIMcSection.tsx`

- [ ] **Step 1: Create AIMcSection**

```tsx
// bk-mobile/features/settings/sections/AIMcSection.tsx
import { View, Text, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import { Check } from 'lucide-react-native';
import { useTheme } from '@/context/ThemeContext';
import { DarkColors, LightColors } from '@/constants/colors';
import { SectionLabel } from '../primitives/SectionLabel';
import { ToggleRow } from '../primitives/ToggleRow';

const MC_VOICE_OPTIONS = [
  { value: 'vi-VN-Neural2-A', labelKey: 'settings.mcVoiceOptions.neural2A' },
  { value: 'vi-VN-Wavenet-C', labelKey: 'settings.mcVoiceOptions.wavenetC' },
  { value: 'vi-VN-Neural2-D', labelKey: 'settings.mcVoiceOptions.neural2D' },
  { value: 'vi-VN-Wavenet-B', labelKey: 'settings.mcVoiceOptions.wavenetB' },
];

interface AIMcSectionProps {
  isMCEnabled: boolean;
  aiScoringEnabled: boolean;
  mcVoice: string;
  onMCEnabledChange: (v: boolean) => void;
  onAiScoringChange: (v: boolean) => void;
  onMcVoiceChange: (v: string) => void;
}

export function AIMcSection({
  isMCEnabled,
  aiScoringEnabled,
  mcVoice,
  onMCEnabledChange,
  onAiScoringChange,
  onMcVoiceChange,
}: AIMcSectionProps) {
  const { t } = useTranslation();
  const { resolvedTheme } = useTheme();
  const c = resolvedTheme === 'dark' ? DarkColors : LightColors;

  return (
    <>
      <SectionLabel label={t('settings.sections.aiMc')} />
      <View style={{ marginHorizontal: 12, marginBottom: 4 }}>
        <ToggleRow
          label={t('settings.aiMcLabel')}
          hint={t('settings.aiMcHint')}
          value={isMCEnabled}
          onValueChange={onMCEnabledChange}
        />
        <ToggleRow
          label={t('scoring.toggleLabel')}
          hint={t('scoring.toggleHelp')}
          value={aiScoringEnabled}
          onValueChange={onAiScoringChange}
        />
        {isMCEnabled && (
          <View
            style={{
              backgroundColor: c.surface2,
              borderWidth: 1,
              borderColor: c.border,
              borderRadius: 12,
              padding: 16,
              marginTop: 8,
            }}
          >
            <Text
              style={{
                color: c.muted,
                fontSize: 10,
                fontWeight: '600',
                textTransform: 'uppercase',
                letterSpacing: 2,
                marginBottom: 12,
              }}
            >
              {t('settings.mcVoiceLabel')}
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {MC_VOICE_OPTIONS.map((opt) => {
                const active = mcVoice === opt.value;
                if (active) {
                  return (
                    <LinearGradient
                      key={opt.value}
                      colors={[c.gradientStart, c.gradientMid, c.gradientEnd]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={{ borderRadius: 12, flex: 1, minWidth: '45%' }}
                    >
                      <TouchableOpacity
                        onPress={() => onMcVoiceChange(opt.value)}
                        activeOpacity={0.8}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          paddingHorizontal: 12,
                          paddingVertical: 10,
                        }}
                      >
                        <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600', flex: 1 }}>
                          {t(opt.labelKey)}
                        </Text>
                        <Check size={14} color="#fff" strokeWidth={2.4} />
                      </TouchableOpacity>
                    </LinearGradient>
                  );
                }
                return (
                  <TouchableOpacity
                    key={opt.value}
                    onPress={() => onMcVoiceChange(opt.value)}
                    activeOpacity={0.7}
                    style={{
                      flex: 1,
                      minWidth: '45%',
                      backgroundColor: c.surface,
                      borderWidth: 1,
                      borderColor: c.border,
                      borderRadius: 12,
                      paddingHorizontal: 12,
                      paddingVertical: 10,
                    }}
                  >
                    <Text style={{ color: c.muted, fontSize: 13 }}>{t(opt.labelKey)}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}
      </View>
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd bk-mobile && git add features/settings/sections/AIMcSection.tsx
git commit -m "feat(mobile): add shared AIMcSection"
```

---

## Task 7: Create ThemeSection

**Files:**
- Create: `bk-mobile/features/settings/sections/ThemeSection.tsx`

This is the new section absent from the current settings screen. It renders an inline 3-button pill (☀️ / 🖥️ / 🌙) on a card row, with the active option highlighted by a brand gradient.

- [ ] **Step 1: Create ThemeSection**

```tsx
// bk-mobile/features/settings/sections/ThemeSection.tsx
import { View, Text, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/context/ThemeContext';
import { DarkColors, LightColors } from '@/constants/colors';
import { SectionLabel } from '../primitives/SectionLabel';
import type { Theme } from '@/context/ThemeContext';

const THEME_OPTIONS: { value: Theme; icon: string }[] = [
  { value: 'light', icon: '☀️' },
  { value: 'system', icon: '🖥️' },
  { value: 'dark', icon: '🌙' },
];

export function ThemeSection() {
  const { t } = useTranslation();
  const { preference, resolvedTheme, setPreference } = useTheme();
  const c = resolvedTheme === 'dark' ? DarkColors : LightColors;

  return (
    <>
      <SectionLabel label={t('settings.sections.appearance')} />
      <View
        style={{
          marginHorizontal: 12,
          marginBottom: 4,
          backgroundColor: c.surface2,
          borderWidth: 1,
          borderColor: c.border,
          borderRadius: 12,
          paddingHorizontal: 16,
          paddingVertical: 14,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <View style={{ flex: 1, marginRight: 12 }}>
          <Text style={{ color: c.fg, fontSize: 14, fontWeight: '500' }}>
            {t('settings.themeLabel')}
          </Text>
          <Text style={{ color: c.muted, fontSize: 12, marginTop: 2 }}>
            {t('settings.themeHint')}
          </Text>
        </View>
        <View
          style={{
            flexDirection: 'row',
            backgroundColor: c.surface,
            borderRadius: 20,
            padding: 3,
            gap: 2,
          }}
        >
          {THEME_OPTIONS.map((opt) => {
            const active = preference === opt.value;
            if (active) {
              return (
                <LinearGradient
                  key={opt.value}
                  colors={[c.gradientStart, c.gradientMid, c.gradientEnd]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{ width: 30, height: 30, borderRadius: 16 }}
                >
                  <TouchableOpacity
                    onPress={() => setPreference(opt.value)}
                    activeOpacity={0.8}
                    style={{
                      width: 30,
                      height: 30,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text style={{ fontSize: 14 }}>{opt.icon}</Text>
                  </TouchableOpacity>
                </LinearGradient>
              );
            }
            return (
              <TouchableOpacity
                key={opt.value}
                onPress={() => setPreference(opt.value)}
                activeOpacity={0.7}
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 16,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ fontSize: 14 }}>{opt.icon}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </>
  );
}
```

- [ ] **Step 2: Add missing `themeLabel` i18n key**

Locale files live in `bk-shared/src/locales/`. `settings.sections.appearance` and `settings.themeHint` already exist — only `themeLabel` is missing.

In `bk-shared/src/locales/vi.json`, add `"themeLabel"` alongside the existing `"themeHint"`:
```json
"settings": {
  ...
  "themeHint": "Chọn giao diện sáng, tối hoặc theo hệ thống.",
  "themeLabel": "Giao diện",
  ...
}
```

In `bk-shared/src/locales/en.json`, add `"themeLabel"` alongside the existing `"themeHint"`:
```json
"settings": {
  ...
  "themeHint": "Pick a light, dark, or system-matching theme.",
  "themeLabel": "Theme",
  ...
}
```

- [ ] **Step 3: Commit**

```bash
cd bk-mobile && git add features/settings/sections/ThemeSection.tsx
git commit -m "feat(mobile): add ThemeSection with 3-way light/system/dark toggle"
```

---

## Task 8: Create RoomSection + index.ts

**Files:**
- Create: `bk-mobile/features/settings/sections/RoomSection.tsx`
- Create: `bk-mobile/features/settings/index.ts`

- [ ] **Step 1: Create RoomSection**

```tsx
// bk-mobile/features/settings/sections/RoomSection.tsx
import { View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/context/ThemeContext';
import { DarkColors, LightColors } from '@/constants/colors';
import { SectionLabel } from '../primitives/SectionLabel';

interface RoomSectionProps {
  roomCode: string;
}

export function RoomSection({ roomCode }: RoomSectionProps) {
  const { t } = useTranslation();
  const { resolvedTheme } = useTheme();
  const c = resolvedTheme === 'dark' ? DarkColors : LightColors;

  return (
    <>
      <SectionLabel label={t('settings.sections.room')} />
      <View
        style={{
          marginHorizontal: 12,
          marginBottom: 4,
          backgroundColor: c.surface2,
          borderWidth: 1,
          borderColor: c.border,
          borderRadius: 12,
          padding: 16,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Text
          style={{
            color: c.muted,
            fontSize: 10,
            fontWeight: '600',
            textTransform: 'uppercase',
            letterSpacing: 2,
          }}
        >
          {t('settings.roomCodeLabel')}
        </Text>
        <LinearGradient
          colors={[c.gradientStart, c.gradientMid, c.gradientEnd]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ borderRadius: 999, paddingHorizontal: 14, paddingVertical: 6 }}
        >
          <Text style={{ color: '#fff', fontSize: 14, fontWeight: 'bold', letterSpacing: 4 }}>
            {roomCode}
          </Text>
        </LinearGradient>
      </View>
    </>
  );
}
```

- [ ] **Step 2: Create index.ts**

```ts
// bk-mobile/features/settings/index.ts
export { SectionLabel } from './primitives/SectionLabel';
export { ToggleRow } from './primitives/ToggleRow';
export { FilterChipRow } from './primitives/FilterChipRow';
export { AutoRandomSection } from './sections/AutoRandomSection';
export { QueueSection } from './sections/QueueSection';
export { AIMcSection } from './sections/AIMcSection';
export { ThemeSection } from './sections/ThemeSection';
export { RoomSection } from './sections/RoomSection';
```

- [ ] **Step 3: Commit**

```bash
cd bk-mobile && git add features/settings/sections/RoomSection.tsx features/settings/index.ts
git commit -m "feat(mobile): add RoomSection and settings feature index"
```

---

## Task 9: Thin out `settings.tsx`

**Files:**
- Modify: `bk-mobile/app/(room)/settings.tsx`

Replace the entire file body — keep the `SafeAreaView` + `ScrollView` shell and compose from the shared sections. The logout button stays inline (it's unique to this screen).

- [ ] **Step 1: Replace settings.tsx**

```tsx
// bk-mobile/app/(room)/settings.tsx
import { View, Text, TouchableOpacity, ScrollView, SafeAreaView } from 'react-native';
import { useTranslation } from 'react-i18next';
import { LogOut } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { getAuth, signOut } from 'firebase/auth';
import { useRoomContext } from '@/context/RoomContext';
import { useTheme } from '@/context/ThemeContext';
import { DarkColors, LightColors } from '@/constants/colors';
import {
  AutoRandomSection,
  QueueSection,
  AIMcSection,
  ThemeSection,
  RoomSection,
} from '@/features/settings';
import type { Genre, SingerType, Tone } from '@bs-kara/shared';

export default function SettingsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { resolvedTheme } = useTheme();
  const c = resolvedTheme === 'dark' ? DarkColors : LightColors;
  const {
    roomData, roomCode, isHost,
    setAutoRandomMode, setRandomFilters, setDragDropEnabled,
    setRequesterPromptEnabled, setMCEnabled, setAiScoringEnabled,
    setMcVoice, setGuestCanRemove,
  } = useRoomContext();

  const handleLogout = async () => {
    await signOut(getAuth());
    router.replace('/');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
      <View
        style={{
          paddingHorizontal: 16,
          paddingVertical: 12,
          borderBottomWidth: 1,
          borderBottomColor: c.border,
        }}
      >
        <Text style={{ color: c.fg, fontSize: 18, fontWeight: '700' }}>
          {t('settings.title')}
        </Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 4, paddingBottom: 48, paddingTop: 4 }}
      >
        <AutoRandomSection
          isAutoRandomMode={roomData.isAutoRandomMode}
          randomFilters={roomData.randomFilters}
          onAutoRandomChange={setAutoRandomMode}
          onFilterChange={(f) => setRandomFilters(f as Partial<{ genre: Genre; type: SingerType; tone: Tone }>)}
        />
        <QueueSection
          dragDropEnabled={roomData.dragDropEnabled}
          requesterPromptEnabled={roomData.requesterPromptEnabled}
          guestCanRemove={roomData.guestCanRemove}
          onDragDropChange={setDragDropEnabled}
          onRequesterPromptChange={setRequesterPromptEnabled}
          onGuestCanRemoveChange={setGuestCanRemove}
        />
        <AIMcSection
          isMCEnabled={roomData.isMCEnabled}
          aiScoringEnabled={roomData.aiScoringEnabled}
          mcVoice={roomData.mcVoice}
          onMCEnabledChange={setMCEnabled}
          onAiScoringChange={setAiScoringEnabled}
          onMcVoiceChange={setMcVoice}
        />
        <ThemeSection />
        <RoomSection roomCode={roomCode} />

        {isHost && (
          <View
            style={{
              marginTop: 32,
              marginHorizontal: 12,
              borderTopWidth: 1,
              borderTopColor: c.border,
              paddingTop: 16,
            }}
          >
            <TouchableOpacity
              onPress={() => void handleLogout()}
              activeOpacity={0.7}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
                paddingHorizontal: 12,
                paddingVertical: 12,
                borderRadius: 12,
              }}
            >
              <LogOut size={16} color={c.danger} />
              <Text style={{ color: c.danger, fontSize: 14 }}>
                {t('header.leaveButton')}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
```

- [ ] **Step 2: Run tests**

```bash
cd bk-mobile && npx jest --no-coverage
```

Expected: all tests pass

- [ ] **Step 3: Commit**

```bash
cd bk-mobile && git add app/\(room\)/settings.tsx
git commit -m "refactor(mobile): thin settings.tsx to compose from shared sections"
```

---

## Task 10: Thin out `SettingsSheet.tsx`

**Files:**
- Modify: `bk-mobile/components/SettingsSheet.tsx`

Keep the position-absolute bottom-sheet wrapper; replace the duplicated section bodies with imports from `features/settings`.

- [ ] **Step 1: Replace SettingsSheet.tsx**

```tsx
// bk-mobile/components/SettingsSheet.tsx
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRoomContext } from '@/context/RoomContext';
import { useTheme } from '@/context/ThemeContext';
import { DarkColors, LightColors } from '@/constants/colors';
import {
  AutoRandomSection,
  QueueSection,
  AIMcSection,
  ThemeSection,
  RoomSection,
} from '@/features/settings';
import type { Genre, SingerType, Tone } from '@bs-kara/shared';

interface SettingsSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsSheet({ isOpen, onClose }: SettingsSheetProps) {
  const { t } = useTranslation();
  const { resolvedTheme } = useTheme();
  const c = resolvedTheme === 'dark' ? DarkColors : LightColors;
  const {
    roomData,
    roomCode,
    setAutoRandomMode,
    setRandomFilters,
    setDragDropEnabled,
    setRequesterPromptEnabled,
    setMCEnabled,
    setAiScoringEnabled,
    setMcVoice,
    setGuestCanRemove,
  } = useRoomContext();

  if (!isOpen) return null;

  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 100 }}>
      <TouchableOpacity
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }}
        activeOpacity={1}
        onPress={onClose}
      />
      <View
        style={{
          backgroundColor: c.surface,
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          paddingHorizontal: 20,
          paddingTop: 24,
          paddingBottom: 40,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
          <Text style={{ color: c.fg, fontSize: 20, fontWeight: 'bold', flex: 1 }}>
            {t('settings.title')}
          </Text>
        </View>
        <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 500 }}>
          <AutoRandomSection
            isAutoRandomMode={roomData.isAutoRandomMode}
            randomFilters={roomData.randomFilters}
            onAutoRandomChange={setAutoRandomMode}
            onFilterChange={(f) => setRandomFilters(f as Partial<{ genre: Genre; type: SingerType; tone: Tone }>)}
          />
          <QueueSection
            dragDropEnabled={roomData.dragDropEnabled}
            requesterPromptEnabled={roomData.requesterPromptEnabled}
            guestCanRemove={roomData.guestCanRemove}
            onDragDropChange={setDragDropEnabled}
            onRequesterPromptChange={setRequesterPromptEnabled}
            onGuestCanRemoveChange={setGuestCanRemove}
          />
          <AIMcSection
            isMCEnabled={roomData.isMCEnabled}
            aiScoringEnabled={roomData.aiScoringEnabled}
            mcVoice={roomData.mcVoice}
            onMCEnabledChange={setMCEnabled}
            onAiScoringChange={setAiScoringEnabled}
            onMcVoiceChange={setMcVoice}
          />
          <ThemeSection />
          <RoomSection roomCode={roomCode} />
        </ScrollView>
      </View>
    </View>
  );
}
```

- [ ] **Step 2: Run the full test suite**

```bash
cd bk-mobile && npx jest --no-coverage
```

Expected: all tests pass

- [ ] **Step 3: Commit**

```bash
cd bk-mobile && git add components/SettingsSheet.tsx
git commit -m "refactor(mobile): thin SettingsSheet.tsx to compose from shared sections"
```
