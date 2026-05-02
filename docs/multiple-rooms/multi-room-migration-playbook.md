# Multi-Room Migration Playbook

This document is a complete, self-contained execution plan for migrating
the app from singleton-active-room architecture to multi-room. When the
trigger conditions are met (see ADR-001 in `architecture-decisions.md`),
the implementer (human or AI agent) should be able to execute this plan
without re-deriving the analysis.

**How to use this file:**

If you are an AI agent (e.g. Claude Code) and the user has tagged this
file asking you to "migrate to multi-room", you must:

1. Read this entire file BEFORE writing any code.
2. Read `docs/architecture-decisions.md` ADR-001, ADR-002, ADR-003.
3. Run the pre-flight checklist in Section 2 of this file.
4. Ask the user the 5 decisions in Section 3 — do NOT assume defaults.
5. Confirm your understanding by stating back the chosen path before
   writing code.
6. Execute Section 4 in commit order. Each commit must pass typecheck,
   lint, and tests before moving on.
7. Run Section 5 verification before declaring done.
8. Draft the new ADR per Section 6.

If any step in the playbook conflicts with what you find in the
codebase, STOP and surface the conflict — do not silently work around
it. Codebase drift since this playbook was written is expected and must
be reported.

---

## 1. Goal and scope

### Goal

Replace the singleton `meta/activeRoom` pointer with a model that
supports multiple concurrent rooms, each identified by its own room
code, with no global "the active room" concept.

### In scope

- Removing `meta/activeRoom` pointer and all code that reads/writes it.
- Removing the mobile auto-claim flow in `useRoomGate`.
- Removing the explicit-leave latch (now redundant — see ADR-002).
- Updating QR generation on TV side to encode room code directly (if
  not already doing so).
- Updating mobile home page to render `JoinForm` by default.
- Drafting a superseding ADR.

### Out of scope (explicitly defer)

- Subscription / billing validation (separate task — see future ADR-007).
- Admin dashboard data pipeline (separate task — see future ADR-008).
- Migrating any data to Firestore (separate decision — see ADR-004).
- Adding authentication if the app currently has none.
- Rate limiting or anti-abuse on room creation (note as follow-up if
  relevant).

If the user asks for any out-of-scope item in the same task, push back
and recommend a separate follow-up task. Doing too much in one PR
violates the same principle that split the original Leave-bug fix into
two commits.

---

## 2. Pre-flight checklist (run BEFORE any code changes)

These checks verify the codebase still matches the assumptions this
playbook was written against. Drift is expected — flag and adapt.

### 2.1 Path-helper integrity

ADR-003 guarantees that all RTDB paths route through `lib/roomPaths.ts`.
Verify this is still true:

```bash
# Should match only roomPaths.ts and test files:
grep -r "meta/activeRoom" --include="*.ts" --include="*.tsx" .

# Should match only roomPaths.ts and test files:
grep -rE 'rooms/\$\{' --include="*.ts" --include="*.tsx" .
```

If production code outside `lib/roomPaths.ts` contains these literals,
that's drift. Add a pre-step commit to route them through the helper
BEFORE starting the migration. Do not work around the drift.

### 2.2 Latch consumer audit

Verify `hasExplicitlyLeft` (from `useRoomGate`) is only consumed by
`features/remote/RemoteClient.tsx`:

```bash
grep -rn "hasExplicitlyLeft" --include="*.ts" --include="*.tsx" .
```

If consumed elsewhere, those sites need updating during the latch
removal step.

### 2.3 End Party flow trace

Re-confirm the End Party flow still works the way ADR-002 documents
(does NOT go through `handleLeave`). Read:

- `features/tv/TVClient.tsx` — should wire `useEndParty(resetRoom)`
- `features/remote/hooks/useEndParty.ts` — should call `resetRoom`
- `hooks/useRoom/settings.ts` `resetRoom` — should only write to
  `rooms/{code}/...` and `lastEndedAt`, never to `meta/activeRoom` or
  the URL

If the End Party flow has changed shape since this playbook was written,
re-evaluate whether removing auto-claim is safe.

### 2.4 QR format inspection

Find where the TV generates the QR code. Likely in `features/tv/`
somewhere. Confirm:

- Is the QR encoding `https://app.com/?room={code}` already? → Good,
  no QR change needed in this migration.
- Is it encoding just `{code}` and the mobile home does the URL
  building? → Need to update.
- Is it encoding something else (token, deep link)? → Stop and report
  to user; this changes scope.

### 2.5 RTDB call site audit

List all files that call `claimOrGetActiveRoom`, `clearActiveRoomIfMatches`,
or `subscribeActiveRoom` from `lib/activeRoom.ts`:

```bash
grep -rn -E "claimOrGetActiveRoom|clearActiveRoomIfMatches|subscribeActiveRoom" \
  --include="*.ts" --include="*.tsx" .
```

Each call site needs to be updated or removed. Expected (subject to
drift):

- `features/remote/hooks/useRoomGate.ts` — auto-claim and pointer
  subscription. Both removed.
- `features/tv/hooks/useTVPresence.ts` — TV claims a room on start.
  Replaced with `createRoom` (see Section 4).
- Test files — updated to match new primitives.

If you find call sites not in this list, surface them.

### 2.6 Test infrastructure check

Confirm Vitest is still the test framework. Confirm `useRoomGate.test.ts`
still exists. The migration will modify these tests significantly — read
them first to understand the existing assertions before changing.

### 2.7 Report findings

After completing 2.1–2.6, report to the user:

- Path-helper integrity: clean / drift found at [files]
- Latch consumers: only RemoteClient / also at [files]
- End Party flow: matches ADR-002 / changed at [files]
- QR format: encodes URL / encodes code only / other [describe]
- Active-room API call sites: [list]
- Any other surprises

WAIT for user acknowledgment before proceeding to Section 3.

---

## 3. Required decisions from user

These cannot be decided in advance because they depend on product
context at the time of migration. Ask the user explicitly. Do not
assume defaults.

### 3.1 Room code generation strategy

How does a TV get a room code when starting a party?

- **Option A — Random 4-digit code, retry on collision** (matches
  current behavior but per-room). Simple, may collide as scale grows.
- **Option B — Random 6+ digit code or nanoid**. Scales further, harder
  to type for OTP.
- **Option C — Code tied to host account** (e.g. user always gets the
  same code, or rotating per-day). Requires authentication.

Recommendation default: A unless app already has auth.

### 3.2 QR code format

What does the TV's QR code encode?

- **Option A — Plain URL with room code** (`https://app.com/?room=XXXX`).
  Simplest. Anyone who sees the QR can join.
- **Option B — URL with short-lived signed token**
  (`https://app.com/?join=eyJ...`). Token expires, prevents QR
  screenshots from being reused. Requires server-side validation
  endpoint and rotation on the TV.
- **Option C — URL with room code + optional token** (hybrid for future
  upgrade path).

Recommendation default: A. Move to B only when subscription/abuse
concerns make it necessary (likely Phase 3, not now).

### 3.3 Mobile home page behavior

What does mobile see at `/` (no `?room=` param) AFTER auto-claim is
removed?

- **Option A — `JoinForm` by default** (OTP entry + scan-QR hint).
  Same as desktop today.
- **Option B — Landing page** with marketing copy and a CTA to scan QR.
  Requires new component.
- **Option C — Recent rooms list** (rooms the user previously joined,
  from localStorage). Requires storage of room history.

Recommendation default: A — reuses existing component, minimal new
surface area.

### 3.4 Backward compatibility window

Are there TVs in the wild running the old singleton-pointer code?

- **Option A — No (dev/staging only, or no users yet).** Big-bang
  migration is safe.
- **Option B — Yes, must support both formats during rollout.**
  Significantly more complex; needs a feature flag and dual-read code
  paths.
- **Option C — Yes but acceptable to break them and force refresh.**
  Communicate downtime, do big-bang.

Recommendation default: A or C unless the app has paying customers
running their own TVs.

### 3.5 Data migration

Is there meaningful data in the current `meta/activeRoom` pointer or
in `rooms/{code}/...` that must be preserved?

- **Option A — No, can wipe and start fresh.** Easiest.
- **Option B — Yes, must preserve `rooms/{code}/...` data** (current
  active party should keep playing through migration). Trickier — the
  per-room data shape doesn't change (per ADR-001), so this is mostly
  about not breaking the current live session.
- **Option C — Yes, full historical archive.** Schedule a separate
  data migration task; out of scope for this playbook.

Recommendation default: A for dev, B for production with active users.

### 3.6 Confirm decisions back to user

Before writing code, restate:

> "Migrating with these choices: [A/B/C for each of 3.1–3.5]. The
> consequences are: [restate from this playbook]. Proceeding to
> implementation. Confirm or override."

WAIT for explicit confirmation. Do not proceed on silence.

---

## 4. Implementation steps

Execute in commit order. Each commit must pass typecheck, lint, and
tests before moving to the next. If any commit's gates fail, fix before
proceeding — do not stack broken commits.

### Commit 1: Add new room primitives in `lib/activeRoom.ts`

Add new functions ALONGSIDE the old ones (don't delete yet — keeps the
codebase functional during migration):

```typescript
// New per-room primitives. Replace claimOrGetActiveRoom usage.

export async function createRoom(): Promise<string> {
  // Generate a code per Section 3.1 decision.
  // Use a transaction at getRoomDataPath(code) to ensure no collision.
  // Retry on collision up to N times (e.g. 5).
  // Initialize the room with minimal scaffolding so it exists in DB.
  // Return the code.
}

export async function roomExists(code: string): Promise<boolean> {
  // Read getRoomDataPath(code) and check existence.
  // Used by mobile join form to validate before navigation.
}

export function subscribeRoomExists(
  code: string,
  cb: (exists: boolean) => void,
): () => void {
  // Realtime subscription, replacing the old pointer subscription.
}
```

Mark old functions (`claimOrGetActiveRoom`, `clearActiveRoomIfMatches`,
`subscribeActiveRoom`) with `@deprecated` JSDoc but keep them working.

Add unit tests for new primitives in `lib/activeRoom.test.ts`.

**Gate:** typecheck + lint + tests pass.

### Commit 2: Update `lib/roomPaths.ts`

Remove `getActiveRoomPointerPath` export (it has no callers after
Commit 3, but removing now forces compile errors that guide Commit 3).

Actually — remove this in Commit 4 instead, AFTER all consumers are
gone. In this commit, just update the header comment to note that the
migration is in progress.

**Gate:** typecheck + lint + tests pass.

### Commit 3: Update TV-side to use new primitives

In `features/tv/hooks/useTVPresence.ts`:

- Replace `claimOrGetActiveRoom` with `createRoom`.
- The TV now creates a brand-new room every time it mounts (or reuses
  the localStorage-cached code if still valid — match existing behavior
  where applicable).
- Update QR generation if needed per Section 3.2 decision.

Update tests that mock `claimOrGetActiveRoom` to mock `createRoom`.

**Gate:** typecheck + lint + tests pass. Manually test: open TV page,
QR shows, scanning QR on phone joins the room. End Party still works.

### Commit 4: Remove auto-claim and latch from `useRoomGate`

This is the heart of the migration. Changes:

1. Delete the auto-claim `useEffect` entirely.
2. Delete `explicitlyLeftRef` and the render-time reset.
3. Delete `autoJoinStartedRef`.
4. Delete `hasExplicitlyLeft` from the return value.
5. Delete the `subscribeActiveRoom` subscription and `activeRoom`,
   `pointerLoaded` state — mobile no longer needs the global pointer.
6. Simplify `handleLeave` — no latch to set.

In `features/remote/RemoteClient.tsx`:

1. Remove the `hasExplicitlyLeft` consumer.
2. Collapse the three-state render: now just two states — in-room (when
   `rawRoomCode` truthy) or `<JoinForm />` (otherwise). The
   pointer-detection skeleton becomes irrelevant — JoinForm renders
   identically on mobile and desktop now.
3. Remove the `activeRoom` / `pointerLoaded` props passed to JoinForm
   (or keep them and update JoinForm to not require them — your call;
   simpler to clean both).

Update or delete `features/remote/hooks/useRoomGate.test.ts`:

- Delete tests 1–4 (latch behavior) — no longer applicable.
- Add new tests for the simpler hook (rawRoomCode parsing, handleLeave
  clearing localStorage and pushing to `/`).

Update `features/remote/components/JoinForm.tsx` if it still references
`activeRoom` / `pointerLoaded` — remove those props.

**Gate:** typecheck + lint + tests pass.

### Commit 5: Delete old primitives in `lib/activeRoom.ts`

Now that nothing calls them:

- Delete `claimOrGetActiveRoom`.
- Delete `clearActiveRoomIfMatches`.
- Delete `subscribeActiveRoom`.
- Delete `getActiveRoomPointerPath` from `lib/roomPaths.ts`.
- Update `lib/roomPaths.ts` header comment to remove the
  `TODO(multi-room)` (the migration is done).
- Delete tests for the removed functions in `lib/activeRoom.test.ts`.

Run a final grep to ensure no stale references:

```bash
grep -rn -E "meta/activeRoom|claimOrGetActiveRoom|clearActiveRoomIfMatches|subscribeActiveRoom|getActiveRoomPointerPath|hasExplicitlyLeft|explicitlyLeftRef" \
  --include="*.ts" --include="*.tsx" .
```

Should return zero matches in production code.

**Gate:** typecheck + lint + tests pass + grep clean.

### Commit 6: Documentation

Update `docs/architecture-decisions.md`:

- Mark ADR-001 status as "Superseded by ADR-XXX".
- Mark ADR-002 status as "Superseded by ADR-XXX" (the latch is gone
  with the auto-claim).
- Add new ADR (next sequential number) per Section 6 of this playbook.

Update `docs/multi-room-migration-playbook.md`:

- Add a "Migration completed on [date]" header banner.
- Optionally archive: rename to `multi-room-migration-playbook-COMPLETED.md`.

**Gate:** docs render correctly in your markdown viewer.

---

## 5. Verification

### 5.1 Automated gates (must all pass)

- `npx tsc --noEmit` clean
- `npm run lint` clean
- `npm test -- --run` all green
- `next build` succeeds (catches issues that dev mode misses)

### 5.2 Manual test plan

Test in this order — earlier tests catch the most common breakage:

1. **TV start party**: Open `/tv` on a desktop browser. Expect: room
   code displayed, QR code rendered, encodes the correct URL per
   Section 3.2 decision.

2. **Mobile scan and join (single room)**: Scan TV QR with phone (or
   manually navigate to the QR URL). Expect: phone enters room, can
   queue songs, sync with TV works.

3. **Mobile leave**: In the room, tap LogOut. Expect: home page renders
   `JoinForm`. NO bounce-back. NO spinner forever. (This was the bug
   ADR-002 fixed; verify it stays fixed without the latch.)

4. **Mobile rejoin via OTP**: From home, enter the room code in the OTP
   form. Expect: joins same room as before.

5. **Two TVs, two rooms** (the new capability): Open `/tv` on TWO
   different browsers / devices. Expect: each gets a DIFFERENT room
   code. Phone scanning TV-A's QR joins TV-A's room only. Phone
   scanning TV-B's QR joins TV-B's room only. NO cross-contamination
   in queue, currentPlaying, etc.

6. **End Party**: On TV-A, end the party. Expect: TV-A resets, phones
   in TV-A's room see "party ended" toast and stay on `/?room=XXXX`
   (per ADR-002 trace — End Party doesn't navigate). TV-B and its
   phones unaffected.

7. **Mobile direct URL with invalid room code**: Navigate phone to
   `/?room=NOTREAL`. Expect: room-missing flow runs, user lands on
   `JoinForm` (the auto-eject still works, just without the latch
   since the latch is gone).

8. **Mobile fresh load with no room param**: Open `/` on a phone
   (incognito to avoid localStorage). Expect: `JoinForm` renders
   immediately. NO auto-claim. NO spinner. (This is the behavior
   change from old to new — the magic "open app, you're in the party"
   UX is gone, replaced with explicit OTP/scan.)

9. **Hard refresh in room**: While in `/?room=XXXX`, Cmd+Shift+R.
   Expect: room reloads cleanly.

10. **localStorage-cached room code on TV**: Refresh the TV page.
    Expect: TV rejoins the same room code it had before (don't create
    a new one on every refresh, or running parties would break).

### 5.3 Multi-room edge cases

Test these because they're the value-add of this migration:

- 3+ rooms simultaneously: queue updates in room A don't appear in
  room B.
- Phone in room A, scan QR for room B: phone leaves A and joins B
  (or asks for confirmation, depending on UX choice — clarify with
  user).
- TV crashes / closes: room data lingers in DB. Note as cleanup
  follow-up if no automated cleanup exists.

### 5.4 Performance / cost sanity check

After migration is in production for a few days:

- Check Firebase RTDB usage. Number of concurrent connections should
  be roughly the same (1 connection per active client, regardless of
  room model).
- Check that orphan rooms (TV closed without End Party) aren't
  accumulating without bound. If they are, schedule a cleanup
  follow-up.

---

## 6. New ADR template

After successful migration, add this to `docs/architecture-decisions.md`:

```markdown
## ADR-XXX: Multi-room architecture

**Status:** Accepted (current)
**Date:** [migration completion date]
**Supersedes:** ADR-001 (singleton pointer), ADR-002 (explicit-leave latch)
**Related:** ADR-003 (path helper foundation made this migration mechanical)

### Context

[Restate why migration was triggered — which ADR-001 trigger condition
fired, in 2-3 sentences.]

### Decision

Replaced singleton `meta/activeRoom` pointer with multiple concurrent
rooms. Each TV creates a fresh room on start; each room is independent.

Specific choices made (from migration playbook Section 3):
- Room code generation: [chosen option, brief rationale]
- QR format: [chosen option, brief rationale]
- Mobile home: [chosen option, brief rationale]
- Backward compat: [chosen option, brief rationale]
- Data migration: [chosen option, brief rationale]

### Consequences

**Positive:**
- Multiple independent parties on the same Firebase project.
- Removed ~[N] lines of complexity in `useRoomGate` (latch, auto-claim
  effect, pointer subscription).
- Removed an entire class of UX bugs around the auto-claim flow.
- ADR-002's latch is no longer needed.

**Negative:**
- Lost the "open app, instantly in party" UX. Users now need to scan
  QR or enter OTP every time. Mitigation: localStorage remembers last
  room code (existing behavior, unchanged).
- [Other negatives discovered during migration]

### Migration executed on [date]

PR: [link]
Playbook used: `docs/multi-room-migration-playbook.md` (now marked
completed).

### Follow-ups noted but not implemented

- [Orphan room cleanup if applicable]
- [Subscription validation — see future ADR-007]
- [Any other observations from migration]
```

---

## 7. Common pitfalls (learned from past similar migrations)

### 7.1 Don't delete `localStorage` reads on TV

The TV likely caches its room code in localStorage (`karaoke_tv_room` or
similar) so a refresh doesn't create a new room. Preserve this behavior
in the new `createRoom` flow — read localStorage first, validate the
cached code still exists in DB via `roomExists`, only call `createRoom`
if not.

### 7.2 Don't break in-flight parties

If you do this migration while a real party is happening, the per-room
data path is unchanged (still `rooms/{code}/...`), so the party itself
keeps running. The breaking change is only on:

- TV refresh during migration: might create a new empty room.
- Mobile cold-load during migration: loses auto-claim, user must
  re-scan or use OTP.

If parties might be live during deploy, deploy during off-hours and
communicate.

### 7.3 Don't expand scope mid-migration

Tempting things to do "while we're in there" — DON'T:
- Switch to authentication
- Add subscription validation
- Refactor unrelated components
- Migrate to Firestore

Each is a separate ADR and a separate PR. Doing them together creates
unreviewable diffs and ambiguous rollback scope.

### 7.4 Test plan order matters

Test 1 (TV start) before Test 5 (two TVs) — if Test 1 fails, Test 5 is
moot. Don't skip ahead.

### 7.5 Watch for stale comments

Migration changes behavior. Comments that described the old behavior
become misleading. Search for:

- Comments mentioning `meta/activeRoom`
- Comments mentioning `auto-claim`, `claim`, `claimOrGetActiveRoom`
- Comments mentioning `End Party` and bouncing
- Comments mentioning `singleton`, `single room`

Update or delete, don't leave them stale.

---

## 8. Rollback plan

If the migration breaks production and rollback is needed:

### 8.1 Within minutes (during deploy)

`git revert` the merge commit. The previous commit had a clean
working state with the singleton pointer. CI redeploys the old
version.

### 8.2 After hours/days (data has accumulated)

If users have been creating multi-room data and you must rollback:

1. Pick the most recent room (highest `createdAt` if tracked, or
   inspect DB) as the "winner".
2. Manually write its code to `meta/activeRoom`.
3. `git revert` the migration PR.
4. Redeploy.
5. Other rooms become orphaned but their data remains; cleanup later.

This is messy. The probability is low if Section 5 verification was
thorough. Don't rely on rollback as a substitute for testing.

### 8.3 If rollback isn't possible

If users have made critical state changes assuming multi-room (e.g.
two parties really did happen simultaneously and matter), forward-fix
instead. Identify the broken behavior, ship a focused patch, don't try
to undo a working migration.

---

## 9. Out-of-scope follow-ups to log after migration

After the migration is done and ADR is written, log these as separate
issues / TODOs (not addressed in the migration PR):

- **Orphan room cleanup.** When a TV crashes without End Party, the
  room data lingers in `rooms/{code}/...`. Need either a TTL, a
  periodic cleanup job, or a "stale room" detector based on
  `isTvActive`. Estimate: small task, write as ADR if cleanup
  strategy is non-trivial.

- **Subscription enforcement.** ADR-001's trigger condition #2
  (public launch / paid users) likely brings this need too. See
  draft of future ADR-007 in `architecture-decisions.md`.

- **Admin dashboard.** Now that multiple rooms exist, ops visibility
  becomes valuable: how many rooms active, which hosts, peak
  participants. See draft of future ADR-008.

- **Room discovery for trusted contexts.** If a venue wants users to
  see "available rooms in this building", that's a discovery problem
  not solved by this migration. Separate decision (likely involves
  scoping rooms to an organization).

---

## 10. Final checklist before declaring "done"

- [ ] All 6 commits landed on a feature branch
- [ ] Section 5.1 automated gates all pass
- [ ] Section 5.2 manual tests 1–10 all pass
- [ ] Section 5.3 multi-room edge cases all pass
- [ ] Grep audit confirms no stale references
- [ ] New ADR drafted and added to `architecture-decisions.md`
- [ ] ADR-001 and ADR-002 marked superseded
- [ ] This playbook marked completed (header banner or rename)
- [ ] PR description summarizes the migration and links to ADRs
- [ ] Reviewer (human) has signed off
- [ ] Out-of-scope follow-ups logged as separate issues

Only after all 10 are checked: merge.