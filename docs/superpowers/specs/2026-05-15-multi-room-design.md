# Multi-Room Support Design

**Date:** 2026-05-15  
**Status:** Approved  
**Approach:** Approach A — Firebase RTDB + Firebase Auth admin

---

## Overview

Upgrade the karaoke system from a single-active-room model to concurrent multi-room support. Each registered user (identified by phone number) owns a permanent room with a short code derived from their phone number's last 4 digits. Multiple rooms can be active simultaneously. An admin panel provides full user and room management.

---

## 1. Firebase Data Model

### Removed
- `meta/activeRoom` — singleton pointer is deleted entirely

### Added

**Registered users** — keyed by normalized phone (strip leading `0`, prefix `84`):
```
registeredUsers/
  84912345678/
    roomCode:    "5678"
    displayName: "Nguyễn Văn A"   (optional)
    suspended:   false
    createdAt:   1715000000000
```

**Reverse lookup index** — O(1) validation: "is this code a registered room?"
```
roomCodeIndex/
  5678:  "84912345678"    ← owner's normalized phone key
  56781: "84912345681"    ← collision-resolved code
```

**Active rooms presence set** — TVs write on connect, remove on disconnect via `onDisconnect`:
```
meta/activeRooms/
  5678:  true
  9012:  true
```

**Room data** — shape unchanged:
```
rooms/
  5678/ … (existing RoomState)
  9012/ … (existing RoomState)
```

### Room code derivation & collision resolution
1. Normalize phone: strip leading `0`, prefix `84` → `0912345678` becomes `84912345678`
2. Base code = last 4 digits of normalized phone → `"5678"`
3. Check `roomCodeIndex/5678` — if absent, claim it
4. If taken, append a numeric suffix starting from `1` → `"56781"`, then `"56782"`, up to `"56789"`. If all single-digit suffixes are taken (extremely unlikely), continue with `"567810"`, `"567811"`, etc.

### Path helpers (`lib/roomPaths.ts`)
Add:
- `getRegisteredUsersPath()` → `'registeredUsers'`
- `getRegisteredUserPath(phone)` → `'registeredUsers/{phone}'`
- `getRoomCodeIndexPath()` → `'roomCodeIndex'`
- `getRoomCodeIndexEntryPath(code)` → `'roomCodeIndex/{code}'`
- `getActiveRoomsPath()` → `'meta/activeRooms'`
- `getActiveRoomPresencePath(code)` → `'meta/activeRooms/{code}'`

Remove:
- `getActiveRoomPointerPath()` — deleted with the singleton

---

## 2. TV Flow

### Room lookup screen
`/tv` opens to a lookup form. The operator enters the registered phone number **or** short room code. TV validates against `roomCodeIndex/` (O(1) read). Shows an error if not found or suspended.

### Room activation
Once validated, the TV:
1. Writes `meta/activeRooms/{code}: true` with `onDisconnect → remove`
2. Sets `rooms/{code}/isTvActive: true` with `onDisconnect → remove` (existing behavior)
3. Stores the claimed code in `localStorage` (`karaoke_tv_room`) so a page refresh re-activates the same room without re-entering the number

### Normal operation
Identical to today — `useRoom(roomCode)`, QR code shows `/?room={code}`, End Party resets room state.

### Code changes
- `useTVPresence.ts` — remove `claimOrGetActiveRoom()`, add `phase: 'lookup' | 'active'` state
- New `TVRoomLookup` component — phone/code input, validation, calls `lib/registeredUsers.ts`
- `lib/activeRoom.ts` — replace `claimOrGetActiveRoom` with `activateRoom(code)` / `deactivateRoom(code)`; keep `subscribeActiveRooms(cb)` for admin panel

---

## 3. Phone / Guest Flow

### Join screen
Plain code entry form + QR scan. No active-room shortcut list.

```
┌─────────────────────────────┐
│  Enter room code            │
│  [ _ ] [ _ ] [ _ ] [ _ ]   │
│                             │
│       [ Join Room ]         │
│                             │
│  — or scan the QR on TV —  │
└─────────────────────────────┘
```

### Join validation
- **QR scan**: URL is `/?room={code}`. `useRoomGate` reads `?room=`, validates against `roomCodeIndex/` — if registered and not suspended, join immediately.
- **Manual entry**: same `roomCodeIndex/` check on submit. Error states: "Room not found" / "Room is not available" (suspended).

### Wrong room recovery
Leave button navigates to `/` which shows the join screen — guest picks the correct code or scans again.

### Code changes
- `useRoomGate.ts` — remove `subscribeActiveRoom` subscription and `activeRoom` state; add async `validateRoomCode(code)` that reads `roomCodeIndex/{code}`; `pointerLoaded` becomes `true` immediately
- `JoinForm.tsx` — remove `activeRoom` and `pointerLoaded` props; remove shortcut button; plain OTP entry only

---

## 4. Admin Panel

### Route
`/admin` — protected by Firebase Auth. `NEXT_PUBLIC_ADMIN_EMAIL` env var holds the authorized email. Any other Firebase Auth user is redirected to `/admin/login`.

### Auth flow
- `/admin/login` — standard Firebase email/password sign-in form
- On sign-in, check `auth.currentUser.email === process.env.NEXT_PUBLIC_ADMIN_EMAIL`
- If match → allow access; otherwise → sign out and show error

### Features

**User management**
- Register user: enter phone + optional display name → derives room code (with collision resolution) → writes `registeredUsers/` + `roomCodeIndex/` entries → shows assigned code
- List all users: phone, room code, display name, created date, suspended badge
- Edit display name
- Reassign room code (updates both `registeredUsers/` and `roomCodeIndex/`)
- Suspend / unsuspend user (sets `suspended` flag; suspended rooms reject join attempts)

**Room control**
- List currently active rooms from `meta/activeRooms/` with display name + phone
- Force-end a party: calls `resetRoom` on that room's Firebase data + removes `meta/activeRooms/{code}`

### New env var
```
NEXT_PUBLIC_ADMIN_EMAIL=owner@example.com
```

---

## 5. New Library: `lib/registeredUsers.ts`

Centralizes all registered-user operations:

- `normalizePhone(raw)` → strips leading `0`, prefixes `84`, strips non-digits
- `deriveBaseCode(normalizedPhone)` → last 4 digits
- `resolveUniqueCode(base)` → async; checks `roomCodeIndex/{base}` — if free returns `base`; otherwise tries `{base}1`, `{base}2`, … until an unclaimed code is found
- `registerUser({ phone, displayName? })` → normalizes, resolves code, writes both RTDB nodes atomically; returns `{ roomCode }`
- `lookupUserByPhone(phone)` → reads `registeredUsers/{normalized}`
- `lookupUserByCode(code)` → reads `roomCodeIndex/{code}` → resolves to user record
- `isValidRoomCode(code)` → boolean; used by `useRoomGate` and `TVRoomLookup`
- `suspendUser(phone)` / `unsuspendUser(phone)`
- `reassignRoomCode(phone, newCode)` → updates both nodes

---

## 6. Migration

Fully additive — no breaking changes to existing data:

1. Deploy new code — TV and phone flows immediately use `registeredUsers/` + `roomCodeIndex/`
2. Admin registers users via the panel
3. The old `meta/activeRoom` node can be deleted from Firebase console after confirming everything works (harmless to leave in place)

No data migration script. No downtime.

---

## 7. Testing

| Layer | Coverage |
|---|---|
| `lib/registeredUsers.ts` | Phone normalization; 4-digit code derivation; collision resolution (4-digit taken → 5-digit → 6-digit); `registerUser` writes both RTDB nodes; suspend/unsuspend; reassign |
| `lib/activeRoom.ts` | `activateRoom` writes correct presence path with onDisconnect; `deactivateRoom` removes it; `subscribeActiveRooms` emits updates |
| `useRoomGate` | Valid registered code → navigates; unknown code → error; suspended code → error; no longer subscribes to singleton |
| `useTVPresence` | Starts in `lookup` phase; valid code → transitions to `active`; localStorage re-attach skips lookup on refresh |
| `JoinForm` | Renders without `activeRoom` prop; no shortcut button; error states render correctly |
| Admin API routes (`/api/admin/*`) | Register user (derives code, handles collision, rejects duplicate phone); force-end room; suspend user; auth guard rejects non-admin |
| Playwright E2E | TV lookup → activate → phone scans QR → joins room; manual code entry → join; wrong code → error message; Leave → back to join screen |
