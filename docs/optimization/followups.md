# Followups

Informational notes from the performance / cleanup passes. Not a TODO list —
items here are observations or out-of-scope findings the user should be
aware of, not work that's queued.

## Round 4 — render performance

### R1 measured and skipped

**Date:** 2026-05-02
**Context:** Round 4 (render performance), R1 step 0 measurement after
R2 + R3 were committed.

**Measurement:** Mounted `RemoteClient` with mocked `useRoom`, mocked
Firebase, and counter wrappers around each candidate leaf. Typed 5 chars
into the search input.

| Component | 5-keystroke render delta |
|---|---:|
| RemoteControls    | 0 |
| EmojiPad          | 0 |
| NowPlayingCard    | 0 |
| SettingsSheet     | 0 (post-mount) |

All four leaves measured **0 cascading renders** during the prescribed
interaction — well under the ≤3 skip threshold. R2 (callback
stabilization) + R3 (memoized result list + module-scope skeletons)
were sufficient to eliminate the typing cascade at the root.
`React.memo` on these leaves would have been pure shallow-comparison
overhead with no rendering benefit.

The counter wrappers were verified by a sanity-probe gear-icon click,
which correctly incremented all four leaves (+1 to RemoteControls /
EmojiPad / NowPlayingCard, +3 to SettingsSheet from mount + post-mount
effects). The 0s above are not measurement bugs.

### Caveat: Firebase-tick cascade not measured (R6 territory)

The 0-cascade result above is for the **search-keystroke** interaction.
A Firebase tick (e.g. another device sends an emoji, adds a queue item,
or toggles a setting) re-renders `RemoteClient` and cascades to every
unmemoized leaf. This was **not** measured in Round 4.

If multi-device active sessions show lag in production — particularly
during high-traffic emoji bursts or rapid queue activity — the right
fix is the audit's **R6**: memoize `useRoomSubscribe`'s reducer so
unchanged Firebase nodes return the prior reference instead of
rebuilding the whole `RoomState`. That would let `React.memo` on
the leaves actually deliver value (since their props would stop
churning every tick).

Bigger surgery than R1's leaf-level memos: touches the central state
shape and risks subtle equality bugs across all `useRoom` consumers.
Out of scope for the optimization pass that produced this note. Revisit
only if production telemetry justifies the risk.

## From earlier audit phases

### L2 — TVClient `userActive` destructure bug (out of scope)

`features/tv/TVClient.tsx:100-102` assigns the entire
`{ visible, bump }` object from `useAutoHide(2500)` to `userActive`,
then uses `!isFs || userActive` for the fullscreen-button visibility.
The object is always truthy, so the auto-hide never fires — the button
is permanently visible in fullscreen. Comment at `:101` documents the
intended behavior ("auto-hides; otherwise it's always visible") but the
implementation never matched.

Fixing this **is user-visible** (button starts auto-hiding after 2.5s
in fullscreen) and was therefore deferred from the optimize pass for a
separate product decision.

### N3 — Firebase `.indexOn` for emoji `timestamp` (out of scope)

`components/EmojiLayer.tsx:55-68` queries
`rooms/{id}/emojis` with `orderByChild('timestamp')` + `startAfter(...)`.
Without an `.indexOn: ['timestamp']` rule in `database.rules.json`,
Firebase logs a warning and ships the entire emojis node down before
filtering — wasted bandwidth on every reaction.

`database.rules.json` was in the optimize pass's no-edit list, so this
is filed here for a separate change.

### B1 — Firebase RTDB chunk duplicated per page (out of scope)

`/` and `/tv` each ship their own copy of `firebase/database` (~219 KB
minified). Turbopack's chunker isn't hoisting this shared module to a
common chunk under the current `next.config.ts`. Fixing requires either
editing `next.config.ts` (no-edit) or lazy-importing Firebase from
`useRoom` (risky — `useRoom` runs synchronously on mount and the page
shell depends on it). Filed here pending a separate proposal.

### N11 — Firebase transaction for `setCurrentPlayingDirectly` (deferred)

When phone + TV both auto-random simultaneously, the second `set()` 
call clobbers the first — user briefly sees song A, then song B 
replaces it. Audit estimated frequency: rare (depends on YouTube API 
latency and concurrency), but observable when both clients are open.

Fix would convert the write to `runTransaction` on the `currentPlaying` 
path: only write if the current value is still null, abort the 
transaction otherwise.

Deferred from Round 3 because (a) requires Firebase emulator or careful 
mock setup to test concurrent writes, (b) changes write semantics in a 
way that needs production observation before committing. Revisit only 
if logs show the race actually firing — not as a precaution.

### N12 — Firebase transaction for `addToPlayedHistory` (deferred)

Same race pattern as N11, applied to `playedHistory` appends. Lost 
appends are possible when both clients finish a song at the same time. 
Effect: `playedHistory` grows slower than expected; same song could 
be auto-randomed again because the dedup check missed it.

Same deferral logic as N11.