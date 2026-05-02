# Architecture Decisions

This document tracks significant architectural and technical decisions made
in this codebase. Each decision is recorded as an ADR (Architecture Decision
Record) with context, rationale, consequences, and migration plans where
relevant.

## How to use this document

- **Read top-down** when onboarding to understand current architecture.
- **Add new ADRs at the bottom** with the next sequential number.
- **Never delete or rewrite history** — if a decision is reversed, write a
  new ADR that supersedes the old one and link them together. Decisions
  that look wrong in hindsight are still valuable context.
- **Keep ADRs short** — context, decision, consequences. Link to code or
  PRs for implementation details.

---

## ADR-001: Single active room via singleton pointer

**Status:** Accepted (current)
**Date:** 2025
**Supersedes:** —
**Superseded by:** — (planned: ADR for multi-room when needed)

### Context

The app is a TV-and-mobile karaoke party experience. A host opens the TV
page, which displays a QR code; guests scan it with their phones to join
the same room and queue songs.

For the MVP / current scale, the product assumption is that **only one
party runs at a time** (single household, single venue). This drove the
initial DB design.

### Decision

Use a singleton pointer at Firebase Realtime Database path
`meta/activeRoom` that holds the room code of the currently active party.

- TV calls `claimOrGetActiveRoom()` which atomically claims a new code if
  the pointer is empty, or returns the existing one.
- Mobile, when landing on `/` without a `?room=` param, auto-claims (i.e.
  reads the same pointer) and redirects to `/?room=XXXX`.
- This makes "open the app on phone → instantly join the active party"
  work without typing an OTP or scanning QR every time.

Per-room data lives at `rooms/{roomCode}/...` (queue, currentPlaying,
history, settings, etc.) — this part is already shaped correctly for
multiple rooms.

### Consequences

**Positive:**
- Simple mental model, simple code.
- "Pick up your phone and you're in the party" UX works without friction.
- Firebase RTDB transactions handle race conditions correctly.

**Negative:**
- Cannot run two parties simultaneously (e.g. two TVs in different rooms
  of the same Firebase project).
- The auto-claim logic creates UX edge cases — see ADR-002.
- Migrating to multi-room later requires changing the pointer logic AND
  updating any code that assumes "the active room" is well-defined.

### When to revisit

Revisit this decision when **any** of these become true:
- Selling to venues / businesses with multiple rooms (e.g. KTV chains).
- Public launch where unrelated users share the same Firebase project.
- A user explicitly requests running two parties at once.

### Migration plan (when triggered)

The migration is mechanical because all RTDB paths route through
`lib/roomPaths.ts` (see ADR-003):

1. Decide the new room-discovery shape. Options:
   - QR-encoded room code in URL only (recommended — simplest, most
     private).
   - Per-user "active room" pointer (`users/{uid}/activeRoom`).
   - Public list of active rooms with picker UI.
2. Replace `claimOrGetActiveRoom` and `clearActiveRoomIfMatches` in
   `lib/activeRoom.ts` with per-code primitives.
3. Remove `getActiveRoomPointerPath` from `lib/roomPaths.ts`.
4. Remove the mobile auto-claim effect in
   `features/remote/hooks/useRoomGate.ts` — mobile home should render
   `JoinForm` directly when no `?room=` is present.
5. Update TV's QR generation to encode `https://app.com/?room={code}`
   directly (likely already does this — verify).

Migration does NOT require changing per-room data shape (`rooms/{code}/...`)
or any of the ~40 RTDB call sites that already use `getRoomDataPath`.

---

## ADR-002: Explicit-leave latch in `useRoomGate`

**Status:** Accepted (current)
**Date:** 2025
**Related:** ADR-001 (mobile auto-claim is the root cause this works around)

### Context

The mobile auto-claim effect from ADR-001 cannot distinguish between three
states that all look identical at the React level (`rawRoomCode: null`,
`isCoarsePointer: true`):

1. Fresh page load on phone — should auto-claim.
2. Post-End-Party return to `/` — should auto-claim into the new room.
3. User just clicked "Leave" — should NOT auto-claim, otherwise they're
   bounced right back into the room they tried to leave.

State 3 was a real user-facing bug: clicking Leave on mobile appeared to
do nothing, because the auto-claim re-fired within milliseconds.

### Decision

Add an in-memory `useRef<boolean>` latch (`explicitlyLeftRef`) in
`useRoomGate`:

- `handleLeave` sets the latch to `true` BEFORE clearing localStorage and
  calling `router.push('/')`.
- The auto-claim effect treats the latch as another early-return
  condition.
- The latch resets at **render time** (not in an effect) when
  `rawRoomCode` becomes truthy again — this avoids a one-render staleness
  where the consumer would briefly see `hasExplicitlyLeft === true`
  immediately after rejoining.

The latch is **deliberately not persisted** to localStorage. A full page
reload clears it, which is the correct recovery surface — after refresh,
mobile should auto-claim normally.

### Consequences

**Positive:**
- Leave button works on mobile.
- End Party flow continues to work (it doesn't go through `handleLeave`,
  so the latch never trips).
- The auto-eject path on `roomMissing` (when Firebase reports the room
  doesn't exist) also trips the latch — user lands on `JoinForm` instead
  of being silently teleported into an unrelated active room. This is a
  privacy improvement.

**Negative:**
- Adds a piece of in-memory state that's invisible from the URL or DB —
  must be remembered when debugging "why doesn't auto-claim fire?".
- The render-time mutation pattern requires an `eslint-disable` for
  `react-hooks/refs`. Same idiom as `hooks/useRoom/subscribe.ts:21`,
  but flag for new contributors.

### When to revisit

This entire mechanism becomes unnecessary once ADR-001 is superseded by
multi-room architecture (auto-claim goes away, so the latch has nothing
to gate). Plan to delete this ADR and the latch together as part of the
multi-room migration.

---

## ADR-003: Centralize Firebase RTDB paths in `lib/roomPaths.ts`

**Status:** Accepted (current)
**Date:** 2025
**Related:** ADR-001 (this is the migration enabler)

### Context

Before this decision, ~40 sites across the codebase hardcoded RTDB paths
as template literals (`` `rooms/${roomId}/queue` ``, `'meta/activeRoom'`,
etc.). Migrating away from the singleton pointer (ADR-001) would require
finding and updating all of them, with high risk of typos and missed
sites.

### Decision

All production RTDB paths route through helpers exported from
`lib/roomPaths.ts`:

- `getActiveRoomPointerPath()` — currently returns `'meta/activeRoom'`,
  marked `TODO(multi-room)` because it disappears when ADR-001 is
  superseded.
- `getRoomDataPath(code)` — returns `rooms/{code}`, kept as-is in the
  multi-room future.

Test files keep literal path strings in assertions, since wrapping them
through the helper would make the test verify "the helper returns what
the helper returns" — a tautology.

### Consequences

**Positive:**
- Multi-room migration is a 2-file change in `lib/` instead of a
  codebase-wide search.
- `TODO(multi-room)` markers tell a future developer exactly what to
  change without re-deriving the analysis.
- Easier to add observability later (e.g. log every RTDB path access for
  debugging) — single chokepoint.

**Negative:**
- One layer of indirection when reading code — a path's actual value is
  one click away instead of inline.
- New contributors might not realize they should use the helper. Mitigate
  with a header comment in `roomPaths.ts` explaining the convention.

### Enforcement

There's no automated lint rule preventing direct `'rooms/'` or
`'meta/activeRoom'` literals. Code review catches it. If this becomes a
recurring miss, add a custom ESLint rule.

---

## ADR-004: Hybrid Firebase RTDB + Firestore for future subscription/admin data

**Status:** Proposed (not yet implemented)
**Date:** 2025
**Triggers implementation:** First feature requiring user-account data
(auth, subscription, admin dashboard)

### Context

The current app uses only Firebase Realtime Database. RTDB is ideal for
the high-frequency realtime sync between TV and mobile (queue updates,
playback state, emoji reactions) — low latency, cheap bandwidth pricing
for this access pattern.

However, future features need different access patterns:
- **Subscription / billing:** queryable by expiration date, by user, by
  status. RTDB only indexes one field; this needs compound queries.
- **Admin dashboard / analytics:** aggregates ("rooms per day", "top
  hosts"), time-series queries. RTDB requires manual denormalized
  counters or a separate export pipeline.
- **Audit / event log:** append-only, queryable by multiple dimensions.

Firestore handles all three well. Migrating realtime room state TO
Firestore would be a regression — Firestore is more expensive per
read/write at the access pattern RTDB excels at.

### Decision (proposed)

Adopt a **hybrid architecture** when the first qualifying feature lands:

- **Firebase RTDB** continues to hold transient, high-frequency state:
  `rooms/{code}/...` (queue, playback, presence, reactions). Discarded
  when a party ends.
- **Firestore** holds persistent, queryable, business-critical data:
  - `users/{userId}` — account info
  - `subscriptions/{subscriptionId}` — billing state
  - `rooms_metadata/{roomCode}` — permanent record of past rooms (host,
    duration, peak participants) for analytics
  - `events/{eventId}` — append-only event log

A Cloud Function would copy final stats from RTDB to
`rooms_metadata` when a party ends, then schedule cleanup of the RTDB
room data.

### Why not migrate fully to Firestore

Firestore realtime listeners are coarser-grained (per document) than
RTDB's path-level listeners, and pricing penalizes high-frequency writes.
A 10-person party with rapid queue mutations and reactions would cost
significantly more on Firestore.

### Why not migrate fully to a self-hosted DB

See ADR-005.

### Open questions to resolve at implementation time

- How does auth bridge the two? (Firebase Auth issues a single token
  usable for both — solved.)
- Schema for `subscriptions` — depends on payment provider chosen
  (Stripe vs other). Defer until that decision.
- Cloud Function vs server-side API endpoint for the RTDB→Firestore
  bridge — depends on hosting choices at the time.

### Consequences

**Positive:**
- Each DB used for what it's best at.
- Subscription validation can use proper queries with security rules.
- Admin dashboard becomes feasible without an export pipeline.

**Negative:**
- Two DB systems to operate, monitor, secure.
- Cross-DB writes aren't transactional — need to handle partial failure
  (e.g. event log written but subscription update failed). Idempotency
  and eventual consistency patterns required.
- Backup and disaster recovery now spans two systems.

---

## ADR-005: Stay on managed Firebase, do not self-host

**Status:** Accepted (current)
**Date:** 2025
**Revisit when:** Monthly Firebase cost exceeds the cost of 1 day of
DevOps engineering time (rough heuristic: ~$500–1000/month at current
hiring rates), OR a legal/compliance requirement forces data residency.

### Context

Self-hosting a database (e.g. PostgreSQL on a VPS) would give us full
control over data and avoid vendor lock-in to Google. The temptation is
real: VPS pricing looks cheap on paper.

### Decision

**Stay on managed Firebase** for the foreseeable future.

### Rationale

The realtime sync layer is the technically hardest part of this app.
Self-hosting it would require building (or integrating):
- WebSocket server with reconnect/heartbeat handling
- Pub/sub layer (e.g. Redis) for multi-instance scale
- Presence detection
- Conflict resolution

Firebase RTDB ships all of this. Replicating it costs months of dev time
and introduces bugs at edge cases (mobile network switching, browser
tab backgrounding, etc.) that Firebase has already solved.

The "VPS is cheap" framing also ignores hidden costs:
- Initial setup (DB tuning, replication, backup script)
- Ongoing maintenance (patches, monitoring, on-call)
- Disaster recovery (have you tested restore?)
- Auxiliary services Firebase bundles for free (Auth, Functions, Hosting,
  Analytics, Crashlytics, FCM)

For our scale (currently free tier, projected to remain modest after
launch), the total cost of self-hosting is dramatically higher than
Firebase's managed offering.

### Consequences

**Positive:**
- Engineering time stays focused on product, not infra.
- Free-tier headroom is large; we don't pay until we have real usage.
- Standard tooling (Firebase Admin SDK, security rules, etc.) is well
  documented.

**Negative:**
- Vendor lock-in. If Google deprecates Firebase RTDB or radically
  changes pricing, migration would be painful.
- Data residency is limited to Firebase's available regions (no
  Vietnam region as of writing — closest is Singapore / Tokyo). May
  become an issue if local data residency laws (e.g. Vietnam Decree
  13/2023) apply to user data.

### When to revisit

Trigger a re-evaluation when:
1. **Cost:** Monthly Firebase bill exceeds the cost of 1 day of DevOps
   engineering. At that point, hiring infra help is cheaper than the
   bill.
2. **Compliance:** A legal requirement mandates data residency in a
   region Firebase doesn't serve.
3. **Vendor risk materializes:** Firebase announces deprecation, pricing
   change, or service degradation that affects us materially.
4. **Scale:** We have 10K+ paying users and an SRE on the team.

Until then, the answer is "stay on Firebase".

---

## Future ADRs (placeholders — not yet decided)

- **ADR-006: QR code format and rotation policy** — to be written when
  multi-room launches and we need to decide whether QR encodes a plain
  room code or a short-lived signed token.
- **ADR-007: Subscription enforcement strategy** — server-side
  validation endpoint shape, caching, failure modes. Write when starting
  Phase 3 from the implementation roadmap.
- **ADR-008: Admin dashboard data pipeline** — how rooms_metadata gets
  populated, whether via Cloud Function trigger or batch job.