# Mobile Search Screen — Web Alignment Design

**Date:** 2026-05-22  
**Scope:** `bk-mobile` Search screen alignment with `bk-web` `SearchPanel`  
**Approach:** Component extraction (mirrors web architecture)

---

## Context

The mobile app's search screen (`bk-mobile/app/(room)/search.tsx`) diverges significantly from the web's `SearchPanel`. Key gaps: single-chip filter instead of multi-select, no voice search, no per-result PlayNow action, no added-to-queue toast, a single spinner instead of skeleton rows, no live queue state tracking, no error differentiation, and no history delete. This spec closes all those gaps using extracted components that parallel the web's structure.

---

## New Dependencies

```bash
npx expo install @react-native-voice/voice expo-av
```

- `@react-native-voice/voice` — speech recognition (requires Expo dev build, not Expo Go)
- `expo-av` — audio playback for pop/ding sound effects

Audio assets `pop.mp3` and `ding.mp3` copied from `bk-web/public/audio/` into `bk-mobile/assets/audio/`.

---

## File Changes

### New files

| File | Purpose |
|---|---|
| `bk-mobile/components/SearchSkeleton.tsx` | 8 shimmer rows shown while fetching |
| `bk-mobile/components/AddedToast.tsx` | Slide-up toast above tab bar after adding a song |
| `bk-mobile/components/VoiceSearchModal.tsx` | Full-screen voice overlay with pulsing mic |
| `bk-mobile/hooks/useVoiceSearch.ts` | Wraps `@react-native-voice/voice` + `expo-av` sounds |
| `bk-mobile/hooks/useQueuedMap.ts` | Derives `Map<videoId, queueId>` from live queue |

### Modified files

| File | What changes |
|---|---|
| `bk-mobile/app/(room)/search.tsx` | Multi-chip Set, wire all new components, error state, history delete |
| `bk-mobile/components/SongResultItem.tsx` | Duration display, PlayNow button, 4 visual states |
| `bk-mobile/locales/vi.json` | 16 new keys (Vietnamese default) |
| `bk-mobile/locales/en.json` | 16 matching English keys |

---

## Component Designs

### SearchSkeleton (`components/SearchSkeleton.tsx`)

Renders 8 placeholder rows with staggered pulse animation (0.1s delay per row). Each row matches the real `SongResultItem` shape: 72×44px thumbnail block + two text-line blocks + pill button block. Uses `Animated.loop` + `Animated.timing` cycling opacity 1→0.4→1.

Replaces the single `ActivityIndicator` in `search.tsx`. Shown when `isSearching && results.length === 0`.

### SongResultItem updates (`components/SongResultItem.tsx`)

**New props:**
```ts
queued?: boolean           // song exists in live queue (from useQueuedMap)
isCurrentlyPlaying?: boolean  // matches currentPlaying.id
onPlayNow?: () => void     // if undefined, PlayNow button is not rendered
```

**Duration:** Rendered as a third line below channel — `video.duration` already exists in `YouTubeVideo` type, just not displayed yet.

**4 button states (right side of row):**

Priority order (highest wins):

| Priority | State | Condition | Add button appearance | PlayNow |
|---|---|---|---|---|
| 1 | Playing | `isCurrentlyPlaying` | Disabled teal outline `Đang phát`, gradient title text | Hidden |
| 2 | In queue | `queued` from useQueuedMap | Grey outline `Trong DS` | Dimmed |
| 3 | Added (session) | `added` Set contains id | Teal outline `✓ Đã thêm` | Dimmed |
| 4 | Default | none of above | Gradient `+ Thêm` | Visible (circle play icon) |

PlayNow button: 32×32px circle outline with play icon, positioned to the left of the add button. Hidden entirely when `!onPlayNow`.

### AddedToast (`components/AddedToast.tsx`)

**Props:**
```ts
video: YouTubeVideo
onViewQueue: () => void
onDismiss: () => void
```

**Layout:** Absolute positioned card, `bottom: tabBarHeight + insets.bottom + 8`, `left/right: 12`. Contains:
- 52×34px thumbnail
- `✓ Đã thêm vào danh sách` badge (teal, CheckCircle2 icon) + song title (1 line, truncated)
- `Xem DS` gradient pill button (32px height, flex centered text)

**Behaviour:**
- Slides up on mount: `Animated.timing` translateY from `+60` to `0`, 250ms ease-out
- Auto-dismisses after 2500ms via `setTimeout`
- `onViewQueue` → navigate to queue tab + call `onDismiss`
- Tap anywhere on card → `onDismiss`

**Tab bar height constant:** `TAB_BAR_HEIGHT = 52` (matches the Expo Router tab bar).

### VoiceSearchModal (`components/VoiceSearchModal.tsx`)

**Props:**
```ts
visible: boolean
interimTranscript: string
onClose: () => void
```

**Layout:** Full-screen `Modal` with `rgba(0,0,0,0.85)` background, centered column:
- X close button (top-right, 36×36px rounded circle)
- Transcript area: large text showing `interimTranscript` or empty (min-height preserved), subtitle `t('voice.recognizing')` beneath
- Pulsing mic: two `Animated.loop` rings (96px, 72px) behind a 56×56px teal gradient mic button
- `t('voice.listening')` label below mic
- `t('voice.hint')` hint line

**Pulsing animation:** Two `Animated.loop` sequences each scaling from 0.95→1.3 and opacity 0.8→0 over 1500ms, offset 300ms between rings.

---

## Hook Designs

### useVoiceSearch (`hooks/useVoiceSearch.ts`)

```ts
interface UseVoiceSearchOptions {
  onFinal: (transcript: string) => void
  onUnsupported: () => void
}

interface UseVoiceSearchResult {
  isListening: boolean
  interimTranscript: string
  start: () => Promise<void>
  stop: () => void
}
```

**Implementation:**
- `start()`: check `Voice.isAvailable()` → if false call `onUnsupported()`; else play `pop.mp3`, call `Voice.start('vi-VN')`, set `isListening = true`
- `stop()`: call `Voice.stop()`, reset state
- `Voice.onSpeechPartialResults`: set `interimTranscript` from first result
- `Voice.onSpeechResults`: play `ding.mp3`, call `onFinal(results[0])`, call `stop()`
- `Voice.onSpeechError`: call `stop()` silently
- Cleanup on unmount: `Voice.destroy()` + `Voice.removeAllListeners()`

Sound objects created once via `Sound.createAsync(require('../assets/audio/pop.mp3'))` inside `start()` (lazy, not on mount).

### useQueuedMap (`hooks/useQueuedMap.ts`)

```ts
function useQueuedMap(queue: QueueItem[]): Map<string, string>
```

Pure `useMemo` over queue:
```ts
return useMemo(
  () => new Map(queue.map(item => [item.id, item.queueId])),
  [queue]
)
```

Used in `search.tsx`:
```ts
const queuedMap = useQueuedMap(roomData.queue)
// per result row:
queued={queuedMap.has(video.id)}
```

---

## search.tsx Changes

### Multi-chip selection

```ts
// Before
const [activeChip, setActiveChip] = useState<string | null>(null)

// After
const [activeChips, setActiveChips] = useState<Set<string>>(new Set())
```

Toggle handler:
```ts
function handleChipToggle(chip: typeof FILTER_CHIPS[number]) {
  setActiveChips(prev => {
    const next = new Set(prev)
    next.has(chip.id) ? next.delete(chip.id) : next.add(chip.id)
    return next
  })
}
```

Search term construction:
```ts
const chipKeywords = FILTER_CHIPS
  .filter(c => activeChips.has(c.id))
  .map(c => c.keyword)
  .join(' ')
const term = [query.trim(), chipKeywords].filter(Boolean).join(' ')
```

Clear button appears when `activeChips.size > 0`, label `t('search.clearFilters', { count: activeChips.size })`.

### Error state

```ts
const [searchError, setSearchError] = useState<'quota' | 'generic' | null>(null)
```

In catch block: check `response.status === 429` or `response.status === 403` → `'quota'`; any other thrown error or non-ok status → `'generic'`. Cleared to `null` at the start of every new search attempt.

Rendered below chip row (only when not loading and results empty):
- `quota` → `AlertCircle` amber + `t('search.errorQuotaTitle')` + `t('search.errorQuotaSubtitle')`
- `no results` (results empty, no error, searched) → `SearchX` muted + `t('search.errorNoResultsTitle')` + `t('search.errorNoResultsSubtitle')`  
- `generic` → `WifiOff` red + `t('search.errorGenericTitle')` + `t('search.errorGenericSubtitle')`

### History delete

In the focused Modal's history `FlatList`, each row gains an X `TouchableOpacity` on the far right that calls `removeHistory(item.q)`. Row layout uses fixed `height: 52` with `alignItems: 'center'` — clock icon | text | thumbnail (optional) | ↖ fill | ✕ delete.

### AddedToast wiring

```ts
const [toastVideo, setToastVideo] = useState<YouTubeVideo | null>(null)

function confirmAdd(video, name) {
  addSongToQueue(video, name)
  setAdded(prev => new Set(prev).add(video.id))
  setToastVideo(video)          // shows toast
  setRequesterModalVisible(false)
}
```

`AddedToast` rendered at the end of the screen tree:
```tsx
{toastVideo && (
  <AddedToast
    video={toastVideo}
    onViewQueue={() => { router.navigate('/(room)/queue'); setToastVideo(null) }}
    onDismiss={() => setToastVideo(null)}
  />
)}
```

### Voice search wiring

```ts
const { isListening, interimTranscript, start: startVoice, stop: stopVoice } =
  useVoiceSearch({
    onFinal: (text) => { setQuery(text); handleSearchSubmit() },
    onUnsupported: () => setSearchError('generic'), // reuse error state with a brief "Thiết bị không hỗ trợ" message
  })
```

Mic button in focused Modal (when `query.length === 0`) calls `startVoice()`. `VoiceSearchModal` shown when `isListening`.

---

## i18n Keys

All new keys added to both `bk-mobile/locales/vi.json` (Vietnamese, default) and `bk-mobile/locales/en.json`.

| Key | Vietnamese | English |
|---|---|---|
| `search.errorQuotaTitle` | Hết lượt tìm kiếm | Search limit reached |
| `search.errorQuotaSubtitle` | Vui lòng thử lại sau ít phút | Please try again in a moment |
| `search.errorNoResultsTitle` | Không tìm thấy bài hát | No songs found |
| `search.errorNoResultsSubtitle` | Thử từ khoá khác | Try a different keyword |
| `search.errorGenericTitle` | Lỗi kết nối | Connection error |
| `search.errorGenericSubtitle` | Kiểm tra mạng và thử lại | Check your connection and retry |
| `search.clearFilters` | Xoá ({{count}}) | Clear ({{count}}) |
| `search.inQueue` | Trong DS | In queue |
| `search.nowPlayingLabel` | Đang phát | Now playing |
| `addedToast.added` | Đã thêm vào danh sách | Added to queue |
| `addedToast.viewQueue` | Xem DS | View queue |
| `voice.listening` | Đang nghe... | Listening... |
| `voice.hint` | Nói tên bài hát bạn muốn tìm | Say the song name you want to find |
| `voice.unsupported` | Thiết bị không hỗ trợ | Device not supported |

---

## Testing

### Unit tests (Vitest / Jest)
- `useQueuedMap` — returns correct Map, updates on queue change, handles empty queue
- `useVoiceSearch` — `onUnsupported` called when `Voice.isAvailable()` returns false; `onFinal` called with first speech result; cleanup destroys Voice on unmount
- `search.tsx` chip toggle — toggling adds/removes from Set; clear resets to empty Set; search term joins active keywords correctly
- Error state derivation — 429 response sets `'quota'`; network error sets `'generic'`; successful empty response sets `null` error + empty results

### Component tests (Testing Library / RNTL)
- `SearchSkeleton` — renders 8 rows
- `AddedToast` — renders song title; tapping "Xem DS" calls `onViewQueue`; tapping card calls `onDismiss`
- `SongResultItem` — renders all 4 button states correctly given prop combinations; duration shown when provided
- `VoiceSearchModal` — renders transcript when provided; X button calls `onClose`

### Manual verification
1. `npx expo start` → open on device
2. Tap search → Modal opens, keyboard focused in panel input
3. Tap multiple chips → all highlight, "Xoá (N)" appears, search re-runs with combined keywords
4. Type query → suggestions appear; X clears and refocuses; ↖ fills without searching
5. History rows show X delete; tapping removes entry immediately
6. Search → 8 skeleton rows appear, then results with duration
7. Add song → AddedToast slides up; "Xem DS" navigates to queue tab
8. All 3 error states render correctly with Lucide icons and Vietnamese text
9. Mic button → voice modal appears with pulsing animation; speaking a song name auto-searches
10. `npx tsc --noEmit` from `bk-mobile/` — no errors
