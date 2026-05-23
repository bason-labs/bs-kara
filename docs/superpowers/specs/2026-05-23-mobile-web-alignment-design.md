# bk-mobile ↔ bk-web Alignment Design

**Date:** 2026-05-23
**Scope:** Align `bk-mobile` (React Native / Expo) with `bk-web`'s mobile view (Next.js)
**Approach:** Navigation structure first, then tab-by-tab sequential (search → player → queue)
**Source of truth:** `bk-web` current code + `design_handoff_search_flow/` bundle for search visual details

---

## Goal

Make bk-mobile behave and look like bk-web on a phone: same 4-tab navigation pattern, same per-tab layout and logic, same component responsibilities. No new Firebase schema changes — all mutations already exist in `@bs-kara/shared`.

---

## Step 1 — Navigation structure

### What bk-web does

`BottomNav` renders 4 buttons: Search / Queue / Player / Cài đặt. Clicking Settings does **not** navigate — it calls `setSettingsOpen(true)` which opens `SettingsSheet` as a bottom sheet. The active tab remains on whichever content tab the user was on.

Visual details:
- Background: `rgba(6,16,15,0.65)`, `borderTopWidth: 1`, `borderColor: '#1f3a3a'`
- Active icon pill: `bg-glow/20` rounded-full, icon `text-glow`; active label `text-fg` semibold
- Inactive: icon + label both `text-muted`
- Queue tab: count badge when `queue.length > 0` — 18×18pt, `bg-accent`, dark text, border-bg
- Player tab icon: `<EQBars />` (animated) when `isPlaying && activeTab !== 'player'`; otherwise `<Play size={20} />`
- Safe-area bottom padding via `useSafeAreaInsets()`

### Changes

**New `bk-mobile/components/BottomNav.tsx`**
- Props: `activeTab: 'search' | 'queue' | 'player'`, `isPlaying: boolean`, `queueLength: number`, `onTabChange(tab) => void`, `onOpenSettings() => void`
- 4 buttons: first 3 call `onTabChange(tab)`, 4th calls `onOpenSettings()`
- Queue badge: absolutely-positioned count bubble
- Player icon: `isPlaying && activeTab !== 'player'` → `<EQBars />`

**New `bk-mobile/components/EQBars.tsx`**
- 4 bars, each a Reanimated `Animated.View` driving height between two values on a looping `withRepeat(withSequence(...))`
- Stagger delays: 0 / 120 / 80 / 200ms
- Gate with `AccessibilityInfo.isReduceMotionEnabled()` — render static bars if true
- Colors: `currentColor` (inherits from parent text color)

**Modified `bk-mobile/app/(room)/_layout.tsx`**
- Add `settingsOpen` state (lifted from individual screens)
- Render `<SettingsSheet isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />` once here
- Expose `openSettings` via a new minimal context at `bk-mobile/context/SettingsContext.tsx`:
  ```ts
  const SettingsContext = createContext<{ openSettings: () => void }>({ openSettings: () => {} })
  ```
- Replace expo-router's default tab bar with a custom `tabBar` prop rendering `<BottomNav />`
- Derive `activeTab` from `usePathname()` (expo-router) inside `BottomNav` — no separate state needed; pathname `/[roomCode]/search` → `'search'`, etc.

**Modified `bk-mobile/app/(room)/search.tsx`, `queue.tsx`, `player.tsx`**
- Remove `settingsVisible` state and `SettingsSheet` import from each screen
- Call `useContext(SettingsContext).openSettings()` anywhere a "settings" trigger is still needed

---

## Step 2 — Search tab

### What bk-web does

- **TopBar:** wordmark + room-code pill (pulsing accent dot inside), no settings gear on mobile
- **SearchBar:** inline Sliders icon (opens FiltersSheet); count badge on icon when ≥1 filter active
- **ChipsRow:** active filters only, shown below search bar as removable pills; hidden when none active
- **FiltersSheet:** `@gorhom/bottom-sheet`; 3 grouped sections; multi-select; "Đặt lại" reset; "Áp dụng N bộ lọc" CTA
- **Results:** 4 states (idle / queued / now-playing / just-added); just-added state shows glow-ring border for 1600ms
- **AddedToast:** queue-position eyebrow ("Vị trí thứ N · ~M phút nữa") + Undo action
- Leave room is inside SettingsSheet only (not in the header)

### Changes

**New `bk-mobile/components/TopBar.tsx`**
- Left: "BS Kara" wordmark (Space Grotesk 600, `text-fg`) + room-code pill (`bg-surface`, border, rounded-full, `text-muted` 12px)
- Pulsing dot inside pill: Reanimated scale loop (`1 → 0.6 → 1`, 2200ms, ease-in-out), reduced-motion aware
- Right: nothing — Settings is in BottomNav; leave room is in SettingsSheet
- Replace `<RoomHeader>` at the top of each screen (`search.tsx`, `queue.tsx`, `player.tsx`) with `<TopBar roomCode={roomCode} />`; TopBar renders inside the screen, not in the layout

**New `bk-mobile/components/FiltersSheet.tsx`**
- Uses `@gorhom/bottom-sheet` (already installed)
- Header: "Bộ lọc bài hát" title + "Đặt lại" reset (right-aligned, muted)
- 3 sections, each with a label + horizontal chip row (multi-select):
  - **Hình thức hát:** Solo / Song ca / Tốp ca
  - **Tông giọng:** Nam / Nữ / Hỗn hợp
  - **Thể loại:** Bolero / Ca cổ / Nhạc trẻ / Tất cả
- Full-width CTA: "Áp dụng {{count}} bộ lọc" (gradient bg) when count > 0; "Xem tất cả bài hát" (surface bg) when 0
- On apply: close sheet + call `onApply(selectedFilters)`

**Modified `bk-mobile/app/(room)/search.tsx`**
- Replace `renderChips` + horizontal ScrollView of all 6 chips with:
  - `<FiltersSheet>` (controlled by `showFiltersSheet` state)
  - Active-only chip pills row below search bar (rendered inline, hidden when `activeChips.size === 0`)
  - Sliders icon in search bar with count badge overlay when `activeChips.size > 0`
- Add `justAddedId: string | null` state — set on successful add, cleared after 1700ms via `setTimeout`
- Pass `justAddedId` to each `<SongResultItem>`
- Enrich `toastVideo` with `queuePos` (index in queue after add + 1) for ETA
- Remove local `settingsVisible` (Section 1)

**Modified `bk-mobile/components/SongResultItem.tsx`**
- Add `isJustAdded?: boolean` prop
- When true: `useAnimatedStyle` drives `borderColor` from `'#7df9ff'` → `'transparent'` over 1600ms (`withTiming`)
- Show "Vừa thêm" pill (Sparkles icon) in place of + button during just-added window

**Modified `bk-mobile/components/AddedToast.tsx`**
- Add `queuePos?: number` prop
- Eyebrow line: "Vị trí thứ {{queuePos}} · ~{{queuePos * 4}} phút nữa" (shown when `queuePos` provided)
- Add `onUndo?: (queueId: string) => void` prop + "Hoàn tác" button (calls `removeSong(queueId)` then dismisses)
- Requires `queueId` in the toast song object — wire from `search.tsx` after add

**New i18n keys** — add to `bk-shared/src/locales/vi.json` + `en.json` (skip any already present from 2026-05-22 plan):
```json
"search.filtersTitle":    "Bộ lọc bài hát",
"search.filtersApply":    "Áp dụng {{count}} bộ lọc",
"search.filtersReset":    "Đặt lại",
"search.filtersAllSongs": "Xem tất cả bài hát",
"row.stateAdded":         "Vừa thêm",
"toast.queuePosition":    "Vị trí thứ {{n}} · ~{{eta}} phút nữa",
"toast.undo":             "Hoàn tác"
```

---

## Step 3 — Player tab

### What bk-web does

- Player tab shows `<NowPlayingCard variant="hero">` (large artwork, expand button) + `<EmojiPad>` + `<RemoteControls>`
- Tapping expand claims a fullscreen surface (`document.requestFullscreen`) and opens `<FullscreenPlayer>` with the actual YouTube embed
- When `isTvActive`: expand button hidden; hidden iframe removed (TV plays audio/video)
- `RemoteControls` has `hasHistory` + `hasQueue` props to disable prev/next when unavailable
- EmojiPad is **only** on the player tab (not on queue tab)

### Changes

**Modified `bk-mobile/components/NowPlayingCard.tsx`** — add `variant` + `onExpand`
- Add `variant?: 'compact' | 'hero'` prop (default `'compact'`)
- **Hero layout:**
  - Full-width 16:9 thumbnail (`Image`, `borderRadius: 16`)
  - "ĐANG PHÁT" pill + pulsing dot overlay (bottom-left)
  - Title 16px semibold, channel 12px muted, requester badge (Mic icon + name)
  - `onExpand` callback → Maximize2 icon button (44×44pt); hidden when `isTvActive` or `onExpand` not provided
  - Skip/remove current button
- Compact variant: unchanged

**New `bk-mobile/components/RemoteControls.tsx`** (replaces `TransportControls` for player tab)
- Props: `isPlaying`, `hasHistory: boolean`, `hasQueue: boolean`, `onPlayPause`, `onPrev`, `onNext`
- SkipBack: 30% opacity + `pointerEvents: 'none'` when `!hasHistory`
- SkipForward: 30% opacity + `pointerEvents: 'none'` when `!hasQueue`
- Keeps existing button sizing and icon set from `TransportControls`

**New `bk-mobile/components/FullscreenPlayer.tsx`**
- `<Modal animationType="slide" statusBarTranslucent presentationStyle="overFullScreen">`
- On mount: `ScreenOrientation.lockAsync(OrientationLock.LANDSCAPE_RIGHT)`
- On unmount / close: `ScreenOrientation.unlockAsync()`
- `YoutubeIframe` at full device dimensions (portrait height becomes landscape width)
- X close button, top-right, 44×44pt, safe-area aware
- One-time "↻ Xoay điện thoại" hint: rendered below video until `AsyncStorage.getItem('seenRotateHint')` is set; writes the flag on first render
- Reduced-motion: `animationType="none"`

**Modified `bk-mobile/app/(room)/player.tsx`**
- Replace inline thumbnail / song info / skip link with `<NowPlayingCard variant="hero" onExpand={() => setFullscreenOpen(true)} />`
- Add `fullscreenOpen` state
- Hidden `YoutubeIframe` (`height={0} width={0}`): render only when `!isTvActive`; pause/stop when `isTvActive`
- Replace `<TransportControls>` with `<RemoteControls hasHistory={roomData.history.length > 0} hasQueue={roomData.queue.length > 0} />`
- EmojiPad stays ✓
- Mount `<FullscreenPlayer>` when `fullscreenOpen && !isTvActive`
- Remove local `settingsVisible` (Section 1)

**Modified `bk-mobile/app/(room)/queue.tsx`**
- Remove `<EmojiPad>` (belongs on player tab)

**New dependency:** `expo-screen-orientation` — install with `npx expo install expo-screen-orientation`

---

## Step 4 — Queue tab

### What bk-web does

- Queue tab (mobile): just the drag list — no EmojiPad, no transport controls
- Each row: drag handle | thumbnail | title + ETA + requester | PlayNow (host only) | remove (host or guestCanRemove)
- PlayNow taps → `ConfirmDialog` → `playSongNow(video, queueId)` (atomic: removes from queue + promotes to currentPlaying)
- Edit requester: tapping the requester badge on a row opens `RequesterDialog` (when `requesterPromptEnabled`)
- "Your song" tint when `item.requesterName === currentUserName`

### Changes

**Modified `bk-mobile/components/QueueItemRow.tsx`** — extend to match bk-web
- Add props: `isHost: boolean`, `guestCanRemove: boolean`, `onPlayNow?: () => void`, `onEditRequester?: () => void`, `queuePosition: number`
- **Layout:** drag handle | thumbnail (56×36pt, radius 6) | title+meta (flex-1) | PlayNow btn | remove btn
- **Title+meta block:**
  - Song title (1 line, ellipsis)
  - ETA: "Vị trí #{{n}} · ~{{eta}} phút" — `eta = queuePosition × 4`, `text-muted`, 11px
  - Requester badge (Mic icon + name); tappable when `onEditRequester` provided
- **PlayNow button:** `Play` icon, 44×44pt; only rendered when `isHost`
- **Remove button:** 44×44pt; rendered when `isHost || guestCanRemove`
- **"Your song" tint:** `backgroundColor: 'rgba(64,224,208,0.06)'` on the row when `item.requesterName === currentUserName`

**New `bk-mobile/components/ConfirmDialog.tsx`**
- `<Modal transparent animationType="fade">`
- Scrim: `rgba(0,0,0,0.6)`, full-screen
- Card: centered, `bg-surface`, radius 20, padding 24
- Title (16px semibold), message (14px muted), Cancel + Confirm buttons in a row
- Confirm button: gradient bg (`expo-linear-gradient`, already installed)
- Props: `open`, `title`, `message`, `confirmLabel`, `cancelLabel`, `onConfirm`, `onCancel`

**Modified `bk-mobile/app/(room)/queue.tsx`**
- Remove `<EmojiPad>` ← already noted in Section 3
- Remove local `settingsVisible` (Section 1)
- Add `pendingPlayNow: QueueItem | null` state
- Pass `isHost`, `guestCanRemove`, `onPlayNow`, `onEditRequester`, `queuePosition` to each `QueueItemRow`
- Mount `<ConfirmDialog>` driven by `pendingPlayNow`
- On confirm: call `playSongNow(pendingPlayNow, pendingPlayNow.queueId)`

**Modified `bk-mobile/context/RoomContext.tsx`** — expose missing mutators
- Add `playSongNow(video: YouTubeVideo, queueId?: string): void` — already in `@bs-kara/shared` `useRoom`
- Add `updateRequesterName(queueId: string, name: string): void` — same
- Add `guestCanRemove: boolean` from `roomData`
- Add `isHost: boolean` — derived from existing `useCurrentHost` hook (already in `bk-mobile/hooks/`)

---

## File map

| Action | File | Section |
|---|---|---|
| Create | `bk-mobile/components/BottomNav.tsx` | 1 |
| Create | `bk-mobile/components/EQBars.tsx` | 1 |
| Create | `bk-mobile/context/SettingsContext.tsx` | 1 |
| Modify | `bk-mobile/app/(room)/_layout.tsx` | 1 |
| Create | `bk-mobile/components/TopBar.tsx` | 2 |
| Create | `bk-mobile/components/FiltersSheet.tsx` | 2 |
| Modify | `bk-mobile/app/(room)/search.tsx` | 2 |
| Modify | `bk-mobile/components/SongResultItem.tsx` | 2 |
| Modify | `bk-mobile/components/AddedToast.tsx` | 2 |
| Modify | `bk-shared/src/locales/vi.json` | 2 |
| Modify | `bk-shared/src/locales/en.json` | 2 |
| Modify | `bk-mobile/components/NowPlayingCard.tsx` | 3 |
| Create | `bk-mobile/components/RemoteControls.tsx` | 3 |
| Create | `bk-mobile/components/FullscreenPlayer.tsx` | 3 |
| Modify | `bk-mobile/app/(room)/player.tsx` | 3 |
| Modify | `bk-mobile/app/(room)/queue.tsx` | 3+4 |
| Modify | `bk-mobile/components/QueueItemRow.tsx` | 4 |
| Create | `bk-mobile/components/ConfirmDialog.tsx` | 4 |
| Modify | `bk-mobile/context/RoomContext.tsx` | 4 |
| Install | `expo-screen-orientation` | 3 |

---

## Color / token reference (dark theme)

```
bg:        #06100f   page background
surface:   #0e1c1c   cards, inputs, sheets
surface-2: #152a2a   hover, inset
surface-3: #1c3a3a   skeleton highlight
border:    #1f3a3a   dividers
fg:        #e0ffff   primary text
muted:     #7aa8a8   secondary text
brand:     #008b8b   active brand
accent:    #40e0d0   turquoise (badges, status)
glow:      #7df9ff   glow ring, active icon
danger:    #ff5f6d
gradient:  #008b8b → #006d6f → #0d98ba (135deg)
```

---

## Acceptance checklist

- [ ] BottomNav shows 4 tabs; Settings tap opens sheet without changing active tab
- [ ] Player tab icon animates EQ bars when `isPlaying` and not on player tab
- [ ] Queue tab shows count badge when queue is non-empty
- [ ] FiltersSheet opens from Sliders icon; filter count badge shows on icon
- [ ] Active filter pills appear below search bar; each removable with X
- [ ] Just-added glow ring animates for 1600ms then fades
- [ ] AddedToast shows queue position + ETA + Undo action
- [ ] TopBar shows wordmark + room-code pill with pulsing dot; no settings gear
- [ ] Player tab: NowPlayingCard hero + EmojiPad + RemoteControls; no EmojiPad on queue tab
- [ ] FullscreenPlayer locks to landscape; one-time "Xoay điện thoại" hint shown
- [ ] PlayNow button visible to host only; ConfirmDialog fires before promoting
- [ ] Remove button respects `guestCanRemove` for non-host users
- [ ] ETA shown on each queue row ("Vị trí #N · ~M phút")
- [ ] All animations gated on `AccessibilityInfo.isReduceMotionEnabled`
- [ ] Vietnamese diacritics render correctly (test: "Đắp mộ cuộc tình")
- [ ] Safe-area insets respected on notch + home-indicator devices
- [ ] Dark theme correct across all 4 tabs
