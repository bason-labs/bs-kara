# Optimization context

A reference snapshot of the bs-kara performance optimization pass for future
sessions to resume work without replaying conversation history. See
`CLAUDE.md` for full conventions and `README.md` for architecture overview.

## 1. Project overview

bs-kara is a Vietnamese karaoke web app with two surfaces sharing a single
Firebase Realtime Database room: `/tv` (shared screen) and `/` (phone
remote). Stack: Next.js 16 (App Router, Turbopack), TypeScript, Firebase
RTDB, Tailwind v4. Code lives in `app/` (App Router routes + API),
`features/remote/` and `features/tv/` (per-surface components + hooks),
`hooks/` (cross-feature React hooks), `lib/` (Firebase, YouTube, random
picker, text utils).

## 2. Optimization pass history

All commits below land on branch `optimize/performance`. Per `git log`, all
commits are dated 2026-05-02; the work spanned multiple review sessions
(each round reviewed and approved per-item) but was committed within the
same UTC day. All preserve user-visible behavior, API contracts, and
Firebase data shapes per the pass's absolute rules.

### Round 1 — Network / cache (4 items shipped)

| Code | Description | Hash | Improvement |
|---|---|---|---|
| N1 | Persist YouTube key rotation cursor across requests | `c24ccf0` | Skips already-403'd keys in same warm function; saves up to N−1 wasted upstream calls/request when N keys are exhausted (per commit body) |
| N8 | Cache `/api/tts` for 24h via `unstable_cache` | `b1e70bc` | Voice-preview samples (16 deterministic combinations) served from cache after first synthesis; failures bypass cache |
| N9 | Cache `/api/suggestions` for 1h via `unstable_cache` | `6f93911` | Common autocomplete prefixes hit cache across devices/users; failures bypass cache |
| N2 | AbortController in `useSearchSuggestions` | `1d0f5b1` | Stale dropdown response cannot clobber fresh one when user types fast |

Items skipped: none in this round.

Key learnings: cache wrappers must throw on errors so `unstable_cache`
never stores empty/error responses; otherwise a transient hiccup locks
the cache for the full TTL. AbortController + cancelled-flag are
complementary — flag prevents setState clobbering, AbortController
cancels the actual network call.

### Round 2 — Bundle size (2 items shipped)

| Code | Description | Hash | Improvement |
|---|---|---|---|
| B2 | Dynamic-import `@hello-pangea/dnd` in `ClientQueue` | `b82892a` | Defer 95 KB (per commit subject); `0ugo-…` chunk now lazy, loaded only when `dragDropEnabled` true |
| B6 | Dynamic-import `SettingsSheet` on first gear-click | `c5afcb2` | Defers ~13 KB SettingsSheet-specific subtree; `useAIVoice` and theme deps stay eager because `FullscreenPlayer` references them |

Items skipped:
- B1 (Firebase RTDB chunk dedup across `/` and `/tv`) — deferred to
  `docs/followups.md`. Requires `next.config.ts` edit (no-edit list)
  or risky lazy-import of Firebase from `useRoom`.

Key learnings: `next/dynamic` with `ssr: false` and no loading prop
returns null until the chunk arrives, which would break the slide-in
animation on first open. SettingsSheet adopted the same `visible`-state
+ rAF pattern that `ConfirmDialog` and `RequesterDialog` already use,
so animation timing stays identical regardless of chunk-load latency.

### Round 3a — Logic correctness (2 items shipped)

| Code | Description | Hash | Improvement |
|---|---|---|---|
| L1 | Default `AI_MC_PROVIDER` to openai when unset/empty/whitespace | `0eb7615` | Documented "OpenAI is default" contract now honored at runtime; protects future deployments without env var. Invisible in current prod (env is set). |
| L4 | AbortController for live MC fetch in `useMCPlayer` | `23cd24e` | Fast skip-skip-skip cancels in-flight `/api/generate-mc` calls instead of letting them run to completion or wait the 6s timeout |

Items deferred:
- N11 (Firebase transaction for `setCurrentPlayingDirectly`) — deferred
  to `docs/followups.md`. Race between phone+TV simultaneous auto-random.
- N12 (Firebase transaction for `addToPlayedHistory`) — deferred to
  `docs/followups.md`. Same race pattern.

Both N11/N12 deferred because they need Firebase emulator or careful
mock setup to test concurrent writes, and change write semantics in a
way that warrants production observation before committing. Revisit
only if logs show the race actually firing.

Key learnings: every logic fix required a FAILING test written FIRST,
verified failing on old code, passing on new code. AbortError from
controller must not be logged — `fetchLiveMcText`'s existing
catch-and-return-null already handles it correctly. Composing per-effect
abort with the existing 6 s timeout uses `AbortSignal.any([sig1, sig2])`
(Node 22+ / jsdom 25+).

### Round 4 — Render performance (2 items shipped, 1 measured-and-skipped)

| Code | Description | Hash | Improvement |
|---|---|---|---|
| R2 | Stabilize `togglePlayPause` callback identity | `a4d4e7c` | Inline-arrow → direct-prop; props now reference-stable. Standalone runtime impact: 0 (cascade unconditional without an ancestor memo). With memo applied, would save 5 of 6 renders per 5-cascade interaction. Sets up R1. |
| R3 | Memoize `SearchPanel` result list + hoist skeletons | `28a3846` | Result-card renders during 5 keystrokes: 6 → 0 (−100 %). Module-scope `SEARCH_SKELETONS` array no longer rebuilt per render. Observable in production today (memo lives inside the component, no ancestor needed). |

Items skipped:
- R1 (React.memo on RemoteControls / EmojiPad / NowPlayingCard /
  SettingsSheet) — measured-and-skipped per `docs/followups.md`. All
  four leaves measured **0 cascading renders** during the 5-keystroke
  search interaction after R2+R3 + lazy SettingsSheet. Adding memo
  would be pure shallow-comparison overhead.
- R4 (VideoPlayer opts memo), R5, R6, R8 — skipped at audit-selection
  time as too speculative for the budget.
- R7 (NowPlayingCard inline `<style>`) — skipped (would require editing
  `app/globals.css`, which is in the no-edit list).

Key learnings: the cascade hypothesized in the audit (parent re-renders
during typing) does not exist for the search-keystroke interaction
because `SearchPanel` properly owns its own state. R3's measurable
benefit comes from stopping the inline result-list from re-rendering on
SearchPanel's own state churn (focus, suggestions, query). React's
`Profiler` boundary commits even when wrapped memoized children bail —
do not use Profiler for memo measurement; instrument with an
internal-counter wrapper component instead. The `git stash` / measure /
unstash dance is the correct way to capture before-numbers with the
same instrumentation as after-numbers.

## 3. Cumulative metrics

| Dimension | Before (start of R1) | After (end of R4) | Improvement |
|---|---|---|---|
| Test count | 219 | 233 | +14 |
| Tests added per round | — | R1: +10, R2: 0, R3a: +4, R4: 0 | +14 net |
| First Load JS (Remote `/`) | 509,406 B (497.5 KB) | 405,011 B (395.5 KB) | −104,395 B (−102 KB, −20.5 %) [from B2/B6 session checkpoints] |
| Lazy-loaded chunks added | 0 | 2+ (B2 + B6 chunks; Turbopack may have created additional split points) | — |
| Upstream API calls deduped | 0 cache hits | YouTube/TTS/suggestions all cache-backed | qualitative |
| Race conditions fixed | — | 2 (suggestions stale-response, MC live-fetch on song change) | — |
| Lint baseline | 0 errors / 0 warnings | 0 / 0 | preserved |
| Typecheck baseline | 0 errors | 0 errors | preserved |

Bundle delta numbers above came from per-batch checkpoint measurements
during the optimization pass, not from a single reproducible build
artifact. Re-verify with `npm run build` if exact bytes matter.

## 4. Conventions established during the pass

- **Atomic commits** — one logical item per commit; never bundle.
- **Conventional Commits subject format** — `perf(scope):`, `fix(scope):`,
  `refactor(scope):`, `docs(scope):`. Body optional; subject preferred
  when the change is obvious from the diff.
- **No Co-Authored-By or Claude attribution trailers** on any commit
  in this repo. Per `CLAUDE.md` "Commit conventions" section.
- **Each round = separate review checkpoint.** User reviewed and approved
  each round before pushing; per-item review for logic-touching changes,
  end-of-round review acceptable for deterministic changes.
- **Failing test FIRST** for every logic fix. Verify the test fails on
  old code, then passes on new code. Show the failure output before
  applying the fix.
- **Measure before / measure after** for every performance optimization.
  Revert if there is no measurable improvement (memoization rule:
  after-count must be strictly less than before-count). Callback
  stabilization that enables future memoization is not memoization
  itself; document the precondition relationship in the commit body if
  shipped without immediate runtime benefit.
- **Remove all instrumentation before committing.** Render counters,
  console.logs, temporary measurement test files — none of these may
  reach the commit. Delete the measurement file as part of the same
  batch as the fix.
- **Use `git mv` for file moves** so history is preserved.
- **Use `git stash`** to capture before-numbers with the same
  instrumentation as after-numbers when measuring render perf — never
  re-instrument between the two captures.
- **Profiler boundary != memo bail signal.** Profiler `onRender` fires
  on commit at the boundary regardless of whether the wrapped
  memoized child bailed. For memo measurement, use an internal counter
  inside the component being memoized.

## 5. How to resume work

A future Claude session (Claude Code or Claude.ai) should follow this
exact order before proposing any optimization work:

1. Read this file (`docs/optimization-context.md`) for the pass history.
2. Read `CLAUDE.md` for project conventions — never violate.
3. Read `docs/followups.md` for deferred items and out-of-scope findings.
4. Ask the user which area they want to work on. Options include:
   - Continue with deferred items: R6 (Firebase tick cascade memoization
     in `useRoomSubscribe`), N11 / N12 (Firebase transactions for
     concurrent writes), L2 (TVClient `userActive` destructure bug,
     user-visible), B1 (Firebase RTDB chunk dedup), N3 (Firebase
     emoji `.indexOn`).
   - Start a fresh audit on a new dimension (a11y, observability,
     security, etc.).
   - Investigate a specific production issue.

Do not propose work before reading those three files. Do not assume
prior optimizations apply at runtime in deployed prod — verify against
the user before relying on any specific behavior.

## 6. Files in `docs/`

- `docs/followups.md` — deferred items and out-of-scope findings.
  Informational, not a TODO list. Includes Round 4 R1 measurement
  notes, Round 3 N11/N12 deferrals, and earlier-phase out-of-scope
  flags (L2, N3, B1).
- `docs/optimization-context.md` — this file.
