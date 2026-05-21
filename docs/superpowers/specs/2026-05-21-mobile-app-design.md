# Mobile App Design Spec

## Goal

Build the `bk-mobile` React Native / Expo app to full feature parity with the web remote (`bk-web`), using the same visual identity (colors, icons, Vietnamese labels) and the same Firebase-backed business logic via `@bs-kara/shared`.

---

## Scope

All features present in the web remote:

| Feature | Detail |
|---|---|
| Auto-join | Subscribe to `meta/activeRoom` on launch; navigate into room automatically |
| Code entry | Fallback join screen — 4–7 digit OTP input → `/api/room-access` gate |
| Search tab | Search bar, YouTube results, add-to-queue, requester name prompt, hot hits when empty |
| Queue tab | Now-playing card, draggable queue list, swipe-to-remove, emoji reaction bar |
| Player tab | YouTube embed (`react-native-youtube-iframe`), transport controls, volume; hidden when TV is online |
| Settings sheet | Auto-random + filters, MC voice picker, drag-drop toggle, guest-remove toggle, theme toggle, leave room |
| Host auth | Firebase phone-number sign-in (SMS OTP), direct room link bypassing guest gate |
| Dark / light theme | Toggle stored in `AsyncStorage`; drives NativeWind `colorScheme`; default dark |

---

## Architecture

**Approach:** screen-by-screen native port. `@bs-kara/shared` provides all Firebase logic and hooks (`useRoom`, `useTransientNotice`, i18n). `bk-mobile` owns only the React Native UI layer.

**YouTube search API:** mobile calls the deployed web URL. Configured via `EXPO_PUBLIC_API_BASE_URL` in `bk-mobile/.env`. No duplication of the BFF.

---

## Color System

Mobile uses the exact tokens from `bk-web/app/globals.css`. Fixed to dark in karaoke context but user-toggleable. Defined in `bk-mobile/constants/colors.ts`.

### Dark theme
| Token | Value | Usage |
|---|---|---|
| `bg` | `#06100f` | Page background |
| `surface` | `#0e1c1c` | Cards, inputs |
| `surface2` | `#152a2a` | Hover, inset |
| `border` | `#1f3a3a` | Dividers |
| `fg` | `#e0ffff` | Primary text |
| `muted` | `#7aa8a8` | Secondary text |
| `brand` | `#008b8b` | Active icons, highlights |
| `accent` | `#40e0d0` | Active tab label |
| `glow` | `#7df9ff` | Glow effects |
| `danger` | `#ff5f6d` | Errors |
| gradient | `#008b8b → #006d6f → #0d98ba` | CTA buttons via `expo-linear-gradient` |

### Light theme
Same structure; tokens match `bk-web/app/globals.css` `:root` block.

---

## Icons

`lucide-react-native` — drop-in equivalent of `lucide-react`. Same icon names, same outline/stroke style.

| Screen | Icon |
|---|---|
| Search tab | `Search` |
| Queue tab | `ListMusic` |
| Player tab | `Disc3` |
| Settings | `Settings` |
| Leave room | `LogOut` |
| Now playing | `Mic` |
| Transport | `Play`, `Pause`, `SkipBack`, `SkipForward` |

---

## File Structure

```
bk-mobile/
  app/
    _layout.tsx              — Root providers: ThemeContext, i18n (via @bs-kara/shared/hooks), Firebase auth listener
    index.tsx                — Gate: reads meta/activeRoom → redirect to (room) or /join
    join.tsx                 — Code entry screen (OTPInput + /api/room-access call)
    (room)/
      _layout.tsx            — Bottom tab bar: Search / Queue / Player (conditional)
      search.tsx             — Search tab
      queue.tsx              — Queue tab
      player.tsx             — Player tab (hidden when roomData.isTvActive)
  components/
    GradientButton.tsx       — expo-linear-gradient brand CTA
    OTPInput.tsx             — 4–7 digit room code input
    SongResultItem.tsx       — Search result row (thumbnail, title, add button)
    NowPlayingCard.tsx       — Compact now-playing strip (title, requester, play/pause)
    QueueItemRow.tsx         — Draggable queue row (drag handle, title, remove)
    TransportControls.tsx    — Prev / play-pause / next buttons
    EmojiPad.tsx             — Emoji reaction bar (same reactions as web)
    SettingsSheet.tsx        — @gorhom/bottom-sheet with all settings sections
    ThemeToggle.tsx          — Sun/Moon icon toggle
  hooks/
    useRoomGate.ts           — Auto-join active room + code entry + room code in navigation state
  context/
    ThemeContext.tsx          — Provides { theme, toggleTheme }; persists to AsyncStorage; drives NativeWind colorScheme
  constants/
    colors.ts                — Light + dark token maps (matches globals.css exactly)
```

---

## Key Dependencies (additions to bk-mobile)

| Package | Purpose |
|---|---|
| `lucide-react-native` | Icons matching web |
| `react-native-youtube-iframe` | YouTube player in Player tab |
| `react-native-draggable-flatlist` | Drag-to-reorder queue |
| `@gorhom/bottom-sheet` | Settings sheet |
| `expo-linear-gradient` | Brand gradient button |
| `@react-native-async-storage/async-storage` | Theme preference persistence |
| `react-native-svg` | Required peer dep for lucide-react-native |

`react-native-reanimated` and `react-native-gesture-handler` are already included with Expo 53 and required by `react-native-draggable-flatlist` and `@gorhom/bottom-sheet`.

---

## Data Flow

```
App launch
  └─ index.tsx
       ├─ subscribe meta/activeRoom (Firebase)
       │    ├─ room found → push /(room), pass roomCode
       │    └─ no room → push /join
       └─ /join: code entry → POST /api/room-access → push /(room)

Inside (room)
  └─ (room)/_layout.tsx
       └─ useRoom(roomCode)  ← @bs-kara/shared/hooks
            ├─ search.tsx: fetch ${EXPO_PUBLIC_API_BASE_URL}/api/youtube/search
            ├─ queue.tsx: roomData.queue, reorderQueue(), removeSong(), sendEmoji()
            └─ player.tsx: roomData.currentPlaying, togglePlayPause(), playNext(), playPrevious()
                           shown only when !roomData.isTvActive
```

---

## Theme System

`ThemeContext` wraps the entire app. On mount it reads the saved preference from `AsyncStorage` (key: `karaoke_theme`). `toggleTheme()` flips between `'dark'` and `'light'`, saves to storage, and calls NativeWind's `useColorScheme` setter. All NativeWind `dark:` classes respond automatically.

Default is `'dark'`.

---

## Join Flow Detail

1. `index.tsx` mounts → subscribes to `meta/activeRoom` in Firebase.
2. If an active room code exists → navigate directly to `/(room)` with that code (same as web mobile auto-join).
3. If no active room → navigate to `/join`.
4. `/join` shows `OTPInput`. On complete → calls `GET ${EXPO_PUBLIC_API_BASE_URL}/api/room-access?roomCode=<code>`.
   - `ok` → navigate to `/(room)`.
   - Error (`room_not_found`, `subscription_expired`) → show inline error message.

---

## Player Tab

- Uses `react-native-youtube-iframe` — renders a native WebView YouTube embed, same API as `react-youtube` on web.
- Tab is hidden from the tab bar when `roomData.isTvActive === true` (TV is online), same as the web fullscreen player gating.
- Shows `TransportControls` (play/pause/skip), volume slider, emoji reactions.

---

## Host Auth

- Firebase phone auth via `signInWithPhoneNumber` (Firebase JS SDK — same SDK the web uses).
- Shown as a section in the Settings sheet when not authenticated.
- Once signed in, the user's `roomCode` is read from `registeredUsers/{phone}` — same lookup as the web's `useCurrentHost`.
- Authenticated hosts navigate directly to their room without the `/api/room-access` gate (same as the web's host link).

---

## i18n

`@bs-kara/shared/hooks` exports `i18n` (react-i18next instance with `en` + `vi` bundles). Mobile initialises it in `app/_layout.tsx` — no duplication of translation files.

Vietnamese labels for tab bar: `t('nav.search')` → "Tìm bài", `t('nav.queue')` → "Hàng chờ", `t('nav.player')` → "Đang phát".

New keys to add to both locale files: `nav.search`, `nav.queue`, `nav.player`.

---

## Out of Scope

- TV screen (`app/tv.tsx` placeholder stays as-is)
- Push notifications
- Offline mode
- QR code scanner (web QR → web remote is the no-app path)
