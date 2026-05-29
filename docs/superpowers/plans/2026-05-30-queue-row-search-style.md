# Queue Row: Match Search Row Style Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Visually align each queue row with the search-results row so they share the same card layout, thumbnail dimensions, title typography, and channel-name subtitle — and drop the per-row "Vị trí #N · ~M phút" line.

**Architecture:** Single-file UI change in `bk-mobile/components/QueueItemRow.tsx`. Replace the bottom-border flat-list look with the same rounded-card container the search list uses (`bk-mobile/components/SongResultItem.tsx`), scale the thumbnail from 56×36 → 110×62, lift the title font from 13 → 14.5 with two-line wrap, and swap the queue-position+ETA `Text` for `item.channel`. Behaviour (drag, play-now, remove, requester pill) and tests for those behaviours stay unchanged; one test that asserts the now-removed ETA string is replaced with a test asserting the channel name renders.

**Tech Stack:** React Native, TypeScript, react-native-draggable-flatlist (existing), Jest + @testing-library/react-native (existing).

---

## File Structure

- **Modify:** `bk-mobile/components/QueueItemRow.tsx` — the only render code that changes.
- **Modify:** `bk-mobile/components/QueueItemRow.test.tsx` — swap one test ("shows ETA text" → "shows channel name").
- **Reference (do not modify):** `bk-mobile/components/SongResultItem.tsx` — the source of the visual we are mirroring.
- **No change:** `bk-mobile/app/(room)/queue.tsx` — the screen wires `DraggableFlatList` to `QueueItemRow` and needs no edits (item spacing comes from the new card margins inside `QueueItemRow`).

---

### Task 1: Replace the queue-row visual with the search-row card

**Files:**
- Modify: `bk-mobile/components/QueueItemRow.tsx` (whole file rewrite)
- Test:   `bk-mobile/components/QueueItemRow.test.tsx`

- [ ] **Step 1: Update the failing test first (TDD)**

Open `bk-mobile/components/QueueItemRow.test.tsx`. Replace the "shows ETA text" test (lines 39-42) with a "shows channel name" test. The full updated test block:

```tsx
  it('shows channel name', () => {
    const { getByText } = render(<QueueItemRow {...base} />);
    expect(getByText('Ch')).toBeTruthy();
  });
```

The existing mock `item` already has `channel: 'Ch'` (line 23), so no fixture changes are needed. Leave the other four behaviour tests (PlayNow visibility, remove for host, remove for guest enabled/disabled) untouched — they don't depend on layout.

- [ ] **Step 2: Run the updated test and confirm it fails**

Run from the `bk-mobile/` directory:

```bash
pnpm test -- QueueItemRow
```

Expected: 1 failed (`shows channel name`) with `Unable to find an element with text: Ch`, 4 passed. Reason: the source still renders the ETA `Text` line, not `item.channel`.

- [ ] **Step 3: Rewrite QueueItemRow.tsx with the search-row visual**

Open `bk-mobile/components/QueueItemRow.tsx`. Replace the **entire file** with:

```tsx
import { View, Text, Image, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { GripVertical, Mic, Play, Trash2 } from 'lucide-react-native';
import type { QueueItem } from '@bs-kara/shared';

interface QueueItemRowProps {
  item: QueueItem;
  index: number;
  queuePosition: number;
  onRemove: () => void;
  drag: () => void;
  dragEnabled?: boolean;
  isHost: boolean;
  guestCanRemove: boolean;
  onPlayNow?: () => void;
  onEditRequester?: () => void;
  currentUserName?: string;
}

export function QueueItemRow({
  item,
  onRemove,
  drag,
  dragEnabled = true,
  isHost,
  guestCanRemove,
  onPlayNow,
  onEditRequester,
  currentUserName,
}: QueueItemRowProps) {
  const { t: _t } = useTranslation();
  const canRemove = isHost || guestCanRemove;
  const isMyRow = currentUserName && item.requesterName === currentUserName;

  const cardBg = isMyRow ? 'rgba(64,224,208,0.06)' : '#0e1c1c';

  return (
    <View style={{
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginHorizontal: 12,
      marginVertical: 4,
      padding: 12,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: '#1f3a3a',
      backgroundColor: cardBg,
    }}>
      {dragEnabled && (
        <TouchableOpacity onLongPress={drag} activeOpacity={0.6} style={{ padding: 4 }}>
          <GripVertical size={18} color="#7aa8a8" />
        </TouchableOpacity>
      )}

      {/* Thumbnail — 110×62 to mirror SongResultItem */}
      <View style={{ width: 110, height: 62, borderRadius: 8, overflow: 'hidden',
        backgroundColor: '#152a2a', flexShrink: 0 }}>
        <Image
          source={{ uri: item.thumbnail }}
          style={{ width: 110, height: 62 }}
          resizeMode="cover"
        />
      </View>

      {/* Content — title + channel (no position, no ETA) */}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          style={{ color: '#e0ffff', fontSize: 14.5, fontWeight: '500', lineHeight: 20 }}
          numberOfLines={2}
        >
          {item.title}
        </Text>
        <Text style={{ color: '#7aa8a8', fontSize: 11.5 }} numberOfLines={1}>
          {item.channel}
        </Text>
        {item.requesterName ? (
          <TouchableOpacity
            onPress={onEditRequester}
            disabled={!onEditRequester}
            activeOpacity={onEditRequester ? 0.7 : 1}
            style={{
              flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start',
              backgroundColor: 'rgba(0,139,139,0.15)', borderRadius: 999,
              paddingHorizontal: 6, paddingVertical: 2, marginTop: 4,
            }}
          >
            <Mic size={10} color="#40e0d0" />
            <Text style={{ color: '#40e0d0', fontSize: 10 }}>{item.requesterName}</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {isHost && onPlayNow && (
        <TouchableOpacity
          testID="play-now-button"
          onPress={onPlayNow}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={{
            width: 36, height: 36, borderRadius: 18, borderWidth: 1,
            borderColor: '#1f3a3a', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Play size={16} color="#40e0d0" fill="#40e0d0" />
        </TouchableOpacity>
      )}

      {canRemove && (
        <TouchableOpacity
          testID="remove-button"
          onPress={onRemove}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={{ padding: 8, flexShrink: 0 }}
        >
          <Trash2 size={18} color="#7aa8a8" />
        </TouchableOpacity>
      )}
    </View>
  );
}
```

Key intentional choices to note:

- `index` and `queuePosition` props **stay in the interface** even though the body no longer uses them: `queue.tsx` still passes them and removing the props would require touching the call site for no benefit. Keep the unused destructure removed so TypeScript doesn't warn — we omit `index` and `queuePosition` from the destructure list above.
- `useTranslation` is still imported because keeping it costs nothing and may be re-needed; aliased as `_t` to satisfy `noUnusedLocals` if enabled. If your tsconfig is permissive about unused destructures, you may delete the line entirely — both are acceptable.
- `borderBottomWidth` separator is gone. Spacing between rows now comes from `marginVertical: 4` on each card (same as `SongResultItem`).
- `isMyRow` tint is preserved as the card background (it used to tint the row band; now it tints the card itself).
- `flexShrink: 0` on thumbnail + right-side buttons keeps the title-area as the only flexible column; on a narrow phone the 2-line title takes the squeeze, not the controls.

- [ ] **Step 4: Run the test suite and confirm green**

```bash
pnpm test -- QueueItemRow
```

Expected: 5 passed (the new `shows channel name` plus the 4 untouched behaviour tests).

- [ ] **Step 5: Run typecheck and the full mobile test suite**

```bash
pnpm typecheck
pnpm test
```

Expected: typecheck has the same pre-existing `SongResultItem.test.tsx(54,23)` error from `duration: undefined` and **no new errors**. `pnpm test` reports the same total test count (~84) all passing.

- [ ] **Step 6: Manual verification on device**

Start Metro and re-run the dev build (no native code changed, a JS reload is enough):

```bash
cd bk-mobile && pnpm expo start --clear
```

In the app:
1. Open the **Hàng chờ** tab on a queue with several songs.
2. Confirm each row now renders as a rounded card with a gap between rows (no flat bottom-border list).
3. Confirm the thumbnail is the large 110×62 size matching the search tab.
4. Confirm the row shows: image, title (up to 2 lines), channel name. **No** "Vị trí #N · ~M phút" line.
5. Drag handle still drags rows when long-pressed; Play (host only) and Trash (host or guests-can-remove) still appear and still fire their callbacks.
6. Open the **Tìm bài** tab and visually compare — queue rows and search rows should look like the same card.

- [ ] **Step 7: Commit**

```bash
git add bk-mobile/components/QueueItemRow.tsx bk-mobile/components/QueueItemRow.test.tsx
git commit -m "feat(queue): match search-row card style, drop position/ETA line"
```

---

## Self-Review

- **Spec coverage:** User asked for (a) bigger row size like search, (b) show image/title/channel, (c) hide position and minutes. (a) — thumbnail 56→110, padding 10→12, card border + margins added. (b) — `item.channel` rendered as new subtitle. (c) — the `Text` containing `t('queue.eta', ...)` is removed. All three covered in Task 1.
- **Placeholder scan:** No TODOs, no "TBD", every code block contains real code or a real command.
- **Type consistency:** `QueueItemRowProps` keeps its existing shape; only the destructure list inside the function changes. `item.channel` is part of `YouTubeVideo`, and `QueueItem extends YouTubeVideo` (verified in `bk-shared/src/types.ts` via existing usage in `SongResultItem.tsx:153`).
- **Behaviour preserved:** Drag, PlayNow, Remove, requester pill — all kept, all still covered by the four untouched tests.

---

Plan complete and saved to `docs/superpowers/plans/2026-05-30-queue-row-search-style.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
