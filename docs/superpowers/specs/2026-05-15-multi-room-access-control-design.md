# Multi-Room Access Control & Safety Design

## Goal

Gate guest access to karaoke rooms behind subscription validity and an owner-controlled toggle, with an inactivity-based session timeout that soft-blocks rather than hard-kicks guests.

## Architecture

Client-side gate validated by a single server-side API route (`/api/room-access`). Firebase real-time subscription for `guestsAllowed` means the owner can open/close the room and all guests react instantly. Inactivity timeout lives entirely in the browser (`localStorage` + `useEffect`) — no per-guest session nodes in Firebase.

## Tech Stack

Next.js 15 App Router, Firebase Realtime Database (client SDK + Admin SDK), React hooks, Vitest, Playwright.

---

## Section 1 — Firebase Data Shape

### New fields

**Room settings** (existing node `rooms/{roomId}/settings`):

```
guestsAllowed: boolean   // false by default; owner sets it when opening the room on TV
```

Written by the TV during room claim (`useTVPresence`) — always initialised to `false`. Owner flips it via a toggle on the waiting overlay.

**Global admin setting** (new node `meta/settings`):

```
sessionTimeoutMinutes: number   // default 60; admin-editable via admin UI
```

### What is NOT added

No per-guest session nodes in Firebase. Guest `lastActiveAt` is stored in `localStorage` only. This keeps Firebase write traffic low and avoids `onDisconnect` cleanup complexity.

---

## Section 2 — Room Access API Route

### Route

`GET /api/room-access?roomCode=XXXX`

Uses the Firebase Admin SDK (server-side reads only — no client auth token required).

### Checks (in order)

1. Room exists in `roomCodeIndex/{code}`
2. Owner's subscription `endDate >= today` (reads `registeredUsers/{normalizedPhone}`)
3. `rooms/{roomId}/settings/guestsAllowed === true`

### Response shape

```ts
{ allowed: boolean; reason: 'ok' | 'room_not_found' | 'subscription_expired' | 'guests_not_allowed' }
```

### Call sites

- **At join time** — `useRoomGate` calls it before writing anything to Firebase or granting room access
- **On rejoin** — after the inactivity timeout overlay, tapping "Tham gia lại" re-calls it before restoring access

The route never mutates data.

---

## Section 3 — TV Side: "Allow Guests" Toggle

### Placement

New toggle **"Cho phép khách tham gia"** shown on the waiting overlay (QR code screen) in `TVClient.tsx` / `WaitingOverlay.tsx`.

### Behaviour

- Defaults to `false` — written to `rooms/{roomId}/settings/guestsAllowed = false` during `useTVPresence` room claim
- Owner flips on → writes `true` to Firebase → guests can immediately join
- Owner flips off → writes `false` → new join attempts blocked; **existing in-session guests are not kicked** (their inactivity timer keeps running)
- `onDisconnect` does **not** clear `guestsAllowed` — if the TV goes offline, existing guests retain access until their inactivity timer fires or the subscription expires

---

## Section 4 — Remote Side: Gate + Inactivity Timer

### `useRoomGate` changes

- Calls `/api/room-access?roomCode=XXXX` before granting room access (both desktop OTP path and mobile auto-join path)
- New gate states: `'guests_not_allowed'` and `'subscription_expired'`
- Mobile auto-join (active-room pointer path) goes through the same validation — no bypass

### New hook: `useInactivityTimeout` (`features/remote/hooks/useInactivityTimeout.ts`)

| Concern | Detail |
|---------|--------|
| Timeout value | Read from Firebase `meta/settings/sessionTimeoutMinutes`; falls back to 60 |
| Persistence | `lastActiveAt` stored in `localStorage` (survives page refresh within timeout window) |
| Reset triggers | Any tap/interaction on RemoteClient, add-to-queue, playback events |
| Expiry | When `now - lastActiveAt > timeout`: sets `timedOut = true` |
| Rejoin | Calls `/api/room-access` again; on `ok` clears `timedOut`; on failure shows appropriate message in overlay |

### New component: `SessionExpiredOverlay.tsx` (`features/remote/components/`)

- Full-screen overlay rendered over the remote UI (no navigation away, no flash)
- Default copy: *"Phiên của bạn đã hết hạn do không hoạt động"* + "Tham gia lại" button
- If rejoin check returns `guests_not_allowed`: swaps copy to "Phòng đã đóng" inline
- If rejoin check returns `subscription_expired`: swaps copy to "Phòng không còn hoạt động"

---

## Section 5 — Error States

### `JoinForm` (desktop OTP) and mobile auto-join

| `reason` | Message | Visual tone |
|----------|---------|-------------|
| `room_not_found` | "Không tìm thấy phòng" | Danger (existing) |
| `subscription_expired` | "Phòng này không còn hoạt động" | Danger |
| `guests_not_allowed` | "Phòng chưa mở — hãy chờ chủ phòng bật chế độ cho khách tham gia" | Info (not an error — guest should wait and retry) |

`JoinForm`: error rendered inline below the input, same pattern as existing `room_not_found`. `guests_not_allowed` uses an info/muted colour rather than the danger colour.

Mobile auto-join: on block, shows a full-screen gate message (same three states above) with a "Thử lại" button. No silent failure.

---

## Edge Cases

| Case | Behaviour |
|------|-----------|
| TV goes offline mid-session | `guestsAllowed` not cleared; guests keep access until inactivity or subscription expiry |
| Owner revokes `guestsAllowed` while guests are in-session | Existing guests finish their session; new joins blocked immediately (Firebase real-time) |
| Subscription expires mid-session | Guest's next rejoin attempt (after timeout) will return `subscription_expired` and block |
| Two guests join simultaneously | Both call `/api/room-access` independently; no race — route is read-only |
| Guest refreshes the page | `lastActiveAt` in `localStorage` is checked on mount; if not expired, access is restored silently |
| Guest opens a second tab | Each tab has its own `lastActiveAt`; second tab starts a fresh timer |
| Admin lowers `sessionTimeoutMinutes` | Takes effect on next timer evaluation (within 1 minute of change) |
