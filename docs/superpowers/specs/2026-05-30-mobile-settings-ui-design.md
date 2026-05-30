# Mobile Settings UI — Design Spec

**Date:** 2026-05-30  
**Scope:** bk-mobile settings screen UI/UX improvements  
**Status:** Approved

---

## Problem

The bk-mobile settings screen has three issues:

1. **Missing theme feature.** `ThemeContext` only supports `dark` / `light` — no `system` option. The `ThemeSection` (3-way toggle) is absent from the settings screen entirely; the `ThemeToggle` only appears on the join screen.
2. **Hardcoded colours.** Both `app/(room)/settings.tsx` and `components/SettingsSheet.tsx` use hardcoded dark-theme hex values directly in inline styles, ignoring the token map in `constants/colors.ts`. The screens don't adapt when the theme changes.
3. **Duplicated code.** All section logic (`SectionLabel`, `ToggleRow`, `FilterChipRow`, and all four sections) is copy-pasted between the two settings files.

---

## Goals

- Add `system` as a third theme preference (following OS setting)
- Add a `ThemeSection` to the settings screen (compact inline 3-button row: ☀️ / 🖥️ / 🌙)
- Wire all settings sections to theme tokens instead of hardcoded values
- Extract shared section components so both settings files share one source of truth
- Tighten spacing and visual consistency to match the bk-web reference design

## Non-goals

- Removing `SettingsSheet.tsx` or migrating `openSettings()` call sites to router navigation (separate task)
- Changes to any other screen outside the settings UI
- New settings options not already present in bk-web

---

## Approach: Extract shared section components

Extract all shared primitives and section components into `bk-mobile/features/settings/`. Both `settings.tsx` and `SettingsSheet.tsx` become thin composition shells importing from this shared module.

---

## Architecture

### 1. ThemeContext upgrade

**File:** `bk-mobile/context/ThemeContext.tsx`

- `Theme` type expands to `'light' | 'dark' | 'system'`
- Add `resolvedTheme: 'light' | 'dark'` — always concrete, derived from the stored preference; when preference is `'system'`, resolved via RN's `useColorScheme()`
- Replace `toggleTheme()` with `setPreference(pref: Theme)` — stores to `AsyncStorage` under existing key `'karaoke_theme'`
- `useTheme()` return shape: `{ preference: Theme, resolvedTheme: 'light' | 'dark', setPreference }`
- `ThemeProvider` subscribes to the OS colour scheme via `useColorScheme` (from `react-native`) so the resolved value updates when the user switches OS appearance while the app is open
- Defaults to `'system'` on first launch (previously `'dark'`)

### 2. Shared settings structure

```
bk-mobile/features/settings/
  primitives/
    SectionLabel.tsx      — uppercase label row with icon
    ToggleRow.tsx         — label + description + Switch
    FilterChipRow.tsx     — horizontal scrollable chip picker
  sections/
    AutoRandomSection.tsx
    QueueSection.tsx
    AIMcSection.tsx
    ThemeSection.tsx      ← new
    RoomSection.tsx
  index.ts                — re-exports all sections and primitives
```

Each section component:
- Calls `useTheme()` internally to get `resolvedTheme`
- Reads colours from `colors[resolvedTheme]` (existing `constants/colors.ts` token map)
- Accepts only the props it strictly needs (room state slices, callbacks) — no colour props passed from above

### 3. ThemeSection component

**File:** `bk-mobile/features/settings/sections/ThemeSection.tsx`

```
┌─────────────────────────────────────────────────────┐
│ ◑  GIAO DIỆN                                        │  ← SectionLabel
├─────────────────────────────────────────────────────┤
│  Giao diện                    [ ☀️ ] [🖥️ active] [🌙] │  ← card row
│  Sáng, tối hoặc theo hệ thống                       │
└─────────────────────────────────────────────────────┘
```

- Calls `useTheme()` for `{ preference, setPreference }`
- Renders a row card with label on the left, 3-button toggle pill on the right
- Active button: `LinearGradient` wrapping the icon button, using `colors[resolvedTheme].brand` as the gradient start/end colour pair (matching the existing voice picker style)
- Inactive buttons: surface background, muted icon tint
- Labels: ☀️ = Sáng, 🖥️ = Hệ thống, 🌙 = Tối (mapped from `preference` values `light / system / dark`)

### 4. Spacing & style changes

Applied consistently across all section components:

| Element | Current | Proposed |
|---|---|---|
| Card horizontal margin | `16px` each side | `12px` each side |
| Card border-radius | `10px` | `12px` |
| Between cards in same section | `2px` gap | `4px` gap |
| Section label top padding | `12px` | `14px` |
| Section label bottom padding | `4px` | `6px` |
| Room code pill background | muted `#1a2e2e` | brand gradient |

### 5. Shell files (thin after refactor)

**`app/(room)/settings.tsx`** — keeps `SafeAreaView` + `ScrollView` wrapper, imports and composes all section components in order: `AutoRandomSection → QueueSection → AIMcSection → ThemeSection → RoomSection`, plus the logout button (host-only).

**`components/SettingsSheet.tsx`** — keeps bottom-sheet positioning logic, imports same section components in the same order (minus logout).

---

## Data flow

```
OS colorScheme (useColorScheme)
        │
        ▼
ThemeContext ──resolvedTheme──▶ colors[resolvedTheme] ──▶ section components
        │
AsyncStorage ('karaoke_theme') ◀── setPreference(pref)
```

---

## Testing

**Unit tests — `ThemeContext`** (`bk-mobile/context/ThemeContext.test.tsx`):

- `resolvedTheme` returns `'dark'` when preference is `'dark'`, regardless of OS scheme
- `resolvedTheme` returns `'light'` when preference is `'light'`, regardless of OS scheme
- `resolvedTheme` follows OS scheme when preference is `'system'`
- `setPreference('system')` persists `'system'` to AsyncStorage
- `resolvedTheme` never returns `'system'` — always `'light'` or `'dark'`

No component tests for section shells — they are purely presentational after token wiring.

---

## File impact summary

| File | Change |
|---|---|
| `context/ThemeContext.tsx` | Add `system`, `resolvedTheme`, `setPreference` |
| `context/ThemeContext.test.tsx` | New — unit tests for resolution logic |
| `features/settings/primitives/SectionLabel.tsx` | New — extracted from settings files |
| `features/settings/primitives/ToggleRow.tsx` | New — extracted from settings files |
| `features/settings/primitives/FilterChipRow.tsx` | New — extracted from settings files |
| `features/settings/sections/AutoRandomSection.tsx` | New — extracted + token-wired |
| `features/settings/sections/QueueSection.tsx` | New — extracted + token-wired |
| `features/settings/sections/AIMcSection.tsx` | New — extracted + token-wired |
| `features/settings/sections/ThemeSection.tsx` | New — the missing theme feature |
| `features/settings/sections/RoomSection.tsx` | New — extracted + token-wired |
| `features/settings/index.ts` | New — re-exports |
| `app/(room)/settings.tsx` | Thinned — imports from features/settings |
| `components/SettingsSheet.tsx` | Thinned — imports from features/settings |
| `components/ThemeToggle.tsx` | Update — replace `toggleTheme()` call with `setPreference()`, cycling `dark → light → system` |
