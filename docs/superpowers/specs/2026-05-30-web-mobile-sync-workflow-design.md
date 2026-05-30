# bk-web → bk-mobile Feature Sync Workflow

**Date:** 2026-05-30  
**Status:** Approved  
**Scope:** Port 11 missing bk-web features into bk-mobile

---

## Goal

Build a Claude Code Workflow script that reads bk-web as the source of truth, identifies missing features in bk-mobile, ports each feature sequentially, and verifies (typecheck + lint) after every implementation. bk-web is never modified.

---

## Constraints

- `bk-web/` is **read-only** — no writes, no edits, ever
- All code changes land exclusively in `bk-mobile/`
- bk-mobile conventions must be followed:
  - **Styling:** NativeWind (Tailwind class names via `className`)
  - **Navigation:** Expo Router
  - **Bottom sheets:** `@gorhom/bottom-sheet`
  - **Animations:** React Native `Animated` API (not CSS transitions)
  - **Storage:** `AsyncStorage` (not `localStorage`)
  - **QR code:** `react-native-qrcode-svg` (not web QR libs)
  - **Voice:** `@react-native-voice/voice` (not Web Speech API)

---

## Phases

### Phase 1 — Analyze (parallel)

11 reader agents run concurrently (one per missing feature). Each agent:
- Reads all relevant bk-web source files for its assigned feature
- Produces a structured port spec (JSON schema output):
  - `sourceFiles`: bk-web files read
  - `targetFiles`: bk-mobile files to create or modify
  - `api`: component/hook signature (props, return values)
  - `firebasePaths`: RTDB paths used
  - `sharedDeps`: imports from `@bs-kara/shared`
  - `rnAdaptations`: React Native–specific substitutions needed

Wall-clock time = slowest single reader agent.

### Phase 2 — Implement + Verify (sequential)

A `for` loop iterates over the 11 features in dependency order. Each iteration:

1. **Implementer agent** — receives the reader spec + full bk-web source for the feature. Writes ported code to bk-mobile. Does not touch unrelated files.
2. **Verifier agent** — runs `npx tsc --noEmit` and `npm run lint` inside `bk-mobile/`. On failure: one self-repair attempt (reads errors, patches specific lines, re-runs). On second failure: halts the workflow and surfaces the full error + diff for manual resolution.

### Phase 3 — Summary

One final agent reads all verifier outputs and produces a markdown summary:
- Per-feature status (`✅ implemented` / `❌ halted`)
- Files created and modified
- Any remaining lint warnings

---

## Feature Implementation Order

| # | Feature | Type | Rationale |
|---|---------|------|-----------|
| 1 | `useSongScore` | Hook | No UI deps; required by ScoreBlock |
| 2 | `ScoreBlock` + `EndScreenOverlay` | Component | Post-song emoji scoring UI; depends on #1 |
| 3 | `EmojiLayer` | Component | Floating emoji animation overlay; `sendEmoji` already exists in shared |
| 4 | `useMCPlayer` | Hook | MC orchestration; required by MCAnnouncementOverlay |
| 5 | `MCAnnouncementOverlay` | Component | AI MC gate UI; depends on #4 |
| 6 | `useAutoRandom` | Hook | Auto-random when queue empty; reads hot-hits pool from Firebase |
| 7 | `useInactivityTimeout` + `SessionExpiredOverlay` | Hook + Component | Paired: hook drives the overlay |
| 8 | `useFullscreenOwnership` | Hook | Firebase transaction lock; wired into `FullscreenPlayer` |
| 9 | `PlayNowButton` | Component | Host-only jump-to-front; wired into `QueueItemRow` |
| 10 | `IdleQRCode` | Component | QR code shown in player screen when nothing is playing |
| 11 | `NeonOrbs` | Component | Decorative animated background on join/home screen |

---

## Per-Feature Agent Responsibilities

### Reader agent prompt (Phase 1)
> "Read the bk-web implementation of `<feature>`. Locate all relevant source files, understand the component API, Firebase paths, and shared hook dependencies. Produce a structured port spec for bk-mobile, noting any web APIs that need a React Native substitute."

### Implementer agent prompt (Phase 2, per feature)
> "Using the port spec and bk-web source below, implement `<feature>` in bk-mobile. bk-web is read-only — write only to bk-mobile/. Follow bk-mobile conventions (NativeWind, Expo Router, @gorhom/bottom-sheet, RN Animated). Do not modify files unrelated to this feature."

### Verifier agent prompt (Phase 2, after each implementer)
> "Run `npx tsc --noEmit` and `npm run lint` in bk-mobile/. Report pass or fail. If there are errors, attempt one self-repair: read the errors, patch the specific lines, re-run. If still failing after the patch, halt and report the full error output and changed diff."

---

## Error Handling

| Scenario | Behaviour |
|----------|-----------|
| Verifier passes first try | Log `✅ <feature>`, continue to next |
| Verifier fails, self-repair succeeds | Log `✅ <feature> (repaired)`, continue |
| Verifier fails after self-repair | Log `❌ <feature>`, halt workflow, surface error + diff |
| Web-only API with no RN equivalent | Implementer picks correct native substitute per constraints table |
| Feature already partially implemented in bk-mobile | Implementer augments existing code rather than replacing it |

---

## Workflow Script Structure (pseudocode)

```js
export const meta = {
  name: 'web-mobile-sync',
  description: 'Port 11 missing bk-web features into bk-mobile sequentially with per-feature verification',
  phases: [
    { title: 'Analyze', detail: 'Read bk-web, produce port specs for all 11 features' },
    { title: 'Implement', detail: 'Port each feature to bk-mobile' },
    { title: 'Verify', detail: 'Typecheck + lint after each feature' },
    { title: 'Summary', detail: 'Produce implementation report' },
  ],
}

const FEATURES = [
  { name: 'useSongScore', webFiles: [...] },
  { name: 'ScoreBlock + EndScreenOverlay', webFiles: [...] },
  // ... 9 more
]

// Phase 1: parallel reader agents
phase('Analyze')
const specs = await parallel(FEATURES.map(f => () =>
  agent(`Read bk-web implementation of ${f.name}...`, { schema: SPEC_SCHEMA, phase: 'Analyze' })
))

// Phase 2: sequential implement + verify
for (let i = 0; i < FEATURES.length; i++) {
  const feature = FEATURES[i]
  const spec = specs[i]

  phase('Implement')
  await agent(`Implement ${feature.name} in bk-mobile...`, { phase: 'Implement' })

  phase('Verify')
  const result = await agent(`Verify: typecheck + lint bk-mobile after ${feature.name}...`, {
    schema: VERIFY_SCHEMA,
    phase: 'Verify',
  })

  if (!result.passed) {
    log(`❌ Halted at ${feature.name}: ${result.error}`)
    return { halted: true, feature: feature.name, error: result.error }
  }

  log(`✅ ${feature.name} implemented and verified`)
}

// Phase 3: summary
phase('Summary')
await agent('Produce implementation summary of all 11 features...')
```

---

## Files Affected

**bk-mobile/ (writes):**
- `hooks/useSongScore.ts` (new)
- `hooks/useMCPlayer.ts` (new)
- `hooks/useAutoRandom.ts` (new)
- `hooks/useInactivityTimeout.ts` (new)
- `hooks/useFullscreenOwnership.ts` (new)
- `components/ScoreBlock.tsx` (new)
- `components/EndScreenOverlay.tsx` (new)
- `components/EmojiLayer.tsx` (new)
- `components/MCAnnouncementOverlay.tsx` (new)
- `components/SessionExpiredOverlay.tsx` (new)
- `components/PlayNowButton.tsx` (new)
- `components/IdleQRCode.tsx` (new)
- `components/NeonOrbs.tsx` (new)
- `app/(room)/player.tsx` (modified — wire in new hooks + overlays)
- `components/QueueItemRow.tsx` (modified — add PlayNowButton)
- `app/join.tsx` or `app/index.tsx` (modified — add NeonOrbs)
- `components/FullscreenPlayer.tsx` (modified — wire useFullscreenOwnership)

**bk-web/ (reads only — never modified)**

---

## Success Criteria

- All 11 features pass `npx tsc --noEmit` and `npm run lint` in bk-mobile
- No changes made to any file under `bk-web/`
- bk-mobile behaves identically to bk-web remote for each ported feature
- Summary report produced at workflow completion
