# bk-web → bk-mobile Feature Sync Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Claude Code Workflow script at `.claude/workflows/web-mobile-sync.js` that reads 11 missing features from bk-web (read-only), ports each one to bk-mobile sequentially, and verifies with typecheck + lint after every feature.

**Architecture:** Three phases — Phase 1 fans out 11 parallel reader agents that produce structured port specs from bk-web source; Phase 2 loops sequentially over the specs running an implementer agent then a verifier agent per feature; Phase 3 writes a summary report. bk-web is never written to.

**Tech Stack:** Claude Code Workflow JS API (`phase`, `parallel`, `agent`, `log`), plain JavaScript (no TypeScript annotations), JSON Schema for structured agent output.

---

## File Structure

```
.claude/
  workflows/
    web-mobile-sync.js        ← the workflow script (CREATE)

docs/superpowers/
  plans/
    2026-05-30-web-mobile-sync-workflow.md   ← this file
  specs/
    2026-05-30-web-mobile-sync-workflow-design.md
  sync-results.md             ← written by the workflow at runtime (not pre-created)
```

**bk-mobile files created/modified by the workflow at runtime** (not by this plan):
- `bk-mobile/hooks/useSongScore.ts` (create)
- `bk-mobile/hooks/useMCPlayer.ts` (create)
- `bk-mobile/hooks/useAutoRandom.ts` (create)
- `bk-mobile/hooks/useInactivityTimeout.ts` (create)
- `bk-mobile/hooks/useFullscreenOwnership.ts` (create)
- `bk-mobile/components/ScoreBlock.tsx` (create)
- `bk-mobile/components/EndScreenOverlay.tsx` (create)
- `bk-mobile/components/EmojiLayer.tsx` (create)
- `bk-mobile/components/MCAnnouncementOverlay.tsx` (create)
- `bk-mobile/components/SessionExpiredOverlay.tsx` (create)
- `bk-mobile/components/PlayNowButton.tsx` (create)
- `bk-mobile/components/IdleQRCode.tsx` (create)
- `bk-mobile/components/NeonOrbs.tsx` (create)
- `bk-mobile/app/(room)/player.tsx` (modify — wire hooks + overlays)
- `bk-mobile/components/QueueItemRow.tsx` (modify — add PlayNowButton)
- `bk-mobile/app/join.tsx` (modify — add NeonOrbs)
- `bk-mobile/components/FullscreenPlayer.tsx` (modify — wire useFullscreenOwnership)

> **Note:** The workflow script itself has no unit tests — it is a workflow orchestrator, not application logic. The verification gate is Phase 2's per-feature typecheck + lint.

---

## Task 1: Scaffold the workflow file with meta + schemas

**Files:**
- Create: `.claude/workflows/web-mobile-sync.js`

- [ ] **Step 1: Create the workflows directory**

```bash
mkdir -p /Users/bason/Documents/bason-labs/bs-kara/.claude/workflows
```

Expected: no output (directory created).

- [ ] **Step 2: Write the file with meta block and JSON schemas**

Create `.claude/workflows/web-mobile-sync.js` with this exact content:

```js
export const meta = {
  name: 'web-mobile-sync',
  description: 'Port 11 missing bk-web features into bk-mobile with per-feature verification',
  phases: [
    { title: 'Analyze', detail: 'Read bk-web source, produce port specs for 11 features' },
    { title: 'Implement', detail: 'Port each feature to bk-mobile (bk-web is read-only)' },
    { title: 'Verify', detail: 'Run typecheck + lint after each feature' },
    { title: 'Summary', detail: 'Write sync-results.md with outcome per feature' },
  ],
}

const REPO = '/Users/bason/Documents/bason-labs/bs-kara'

const SPEC_SCHEMA = {
  type: 'object',
  required: ['feature', 'sourceFiles', 'targetFiles', 'api', 'rnAdaptations', 'webSourceContent'],
  properties: {
    feature: { type: 'string' },
    sourceFiles: { type: 'array', items: { type: 'string' } },
    targetFiles: {
      type: 'array',
      items: {
        type: 'object',
        required: ['path', 'action'],
        properties: {
          path: { type: 'string' },
          action: { type: 'string', enum: ['create', 'modify'] },
        },
      },
    },
    api: { type: 'string' },
    firebasePaths: { type: 'array', items: { type: 'string' } },
    sharedDeps: { type: 'array', items: { type: 'string' } },
    rnAdaptations: { type: 'array', items: { type: 'string' } },
    webSourceContent: { type: 'string' },
  },
}

const VERIFY_SCHEMA = {
  type: 'object',
  required: ['passed'],
  properties: {
    passed: { type: 'boolean' },
    errors: { type: 'string' },
    warnings: { type: 'string' },
  },
}
```

- [ ] **Step 3: Verify the file parses as valid JS**

```bash
node --input-type=module < /Users/bason/Documents/bason-labs/bs-kara/.claude/workflows/web-mobile-sync.js 2>&1 | head -5
```

Expected: error about `phase is not defined` (the workflow API functions aren't available outside the harness — this is correct; it means the exports and schemas parsed fine). If you see a `SyntaxError`, fix the syntax before continuing.

- [ ] **Step 4: Commit**

```bash
cd /Users/bason/Documents/bason-labs/bs-kara && git add .claude/workflows/web-mobile-sync.js && git commit -m "feat(workflow): scaffold web-mobile-sync with meta and schemas"
```

---

## Task 2: Add the FEATURES array

**Files:**
- Modify: `.claude/workflows/web-mobile-sync.js`

- [ ] **Step 1: Append the FEATURES array after the VERIFY_SCHEMA block**

Add this block to the end of the file (after `VERIFY_SCHEMA`):

```js
const FEATURES = [
  {
    name: 'useSongScore',
    description: 'Hook that subscribes to Firebase RTDB emoji reactions for the current song and computes a numeric score + verdict string. Uses onChildAdded to collect reactions since the song started.',
    webFiles: [
      'bk-web/hooks/useSongScore.ts',
    ],
  },
  {
    name: 'ScoreBlock + EndScreenOverlay',
    description: 'ScoreBlock renders a post-song emoji-vote score display with emoji breakdown and a verdict message. EndScreenOverlay wraps ScoreBlock in a full-screen between-songs overlay with a fade-out transition.',
    webFiles: [
      'bk-web/components/ScoreBlock.tsx',
      'bk-web/components/EndScreenOverlay.tsx',
    ],
  },
  {
    name: 'EmojiLayer',
    description: 'Animated floating emoji overlay. Exposes an imperative ref handle with addEmoji(emoji) that spawns a new flying emoji. Each emoji animates upward with random horizontal drift and fades out. Used in the player screen.',
    webFiles: [
      'bk-web/components/EmojiLayer.tsx',
    ],
  },
  {
    name: 'useMCPlayer',
    description: 'Hook that orchestrates AI MC announcements: checks lastAnnouncedSongId lock in Firebase, fetches MC text from /api/generate-mc, speaks via /api/tts (Google Cloud TTS with expo-speech fallback), and gates video playback during speech. Writes lastAnnouncedSongId to prevent double-announcements across devices.',
    webFiles: [
      'bk-web/hooks/useMCPlayer.ts',
      'bk-web/hooks/useAIVoice.ts',
    ],
  },
  {
    name: 'MCAnnouncementOverlay',
    description: 'Full-screen overlay shown while isMcGated is true. Displays the MC announcement text with a fade-in animation. Shown in the player screen over the video.',
    webFiles: [
      'bk-web/components/MCAnnouncementOverlay.tsx',
    ],
  },
  {
    name: 'useAutoRandom',
    description: 'Hook that fires when queue is empty, hasCurrentPlaying is false, and autoRandomEnabled is true. Uses buildRandomSearchQuery + pickRandomTitle from @bs-kara/shared to pick a song, calls the /api/youtube/search BFF, and writes the result to currentPlaying via setCurrentPlayingDirectly. Internal busy ref prevents double-fires.',
    webFiles: [
      'bk-web/hooks/useAutoRandom.ts',
    ],
  },
  {
    name: 'useInactivityTimeout + SessionExpiredOverlay',
    description: 'useInactivityTimeout polls Firebase every 60 seconds and compares lastEndedAt against the current time plus a 60-minute threshold. SessionExpiredOverlay is a full-screen modal that blocks UI when the session expires, with a "Rejoin" button.',
    webFiles: [
      'bk-web/features/remote/hooks/useInactivityTimeout.ts',
      'bk-web/features/remote/components/SessionExpiredOverlay.tsx',
    ],
  },
  {
    name: 'useFullscreenOwnership',
    description: 'Firebase runTransaction lock on rooms/{roomId}/fullscreenOwner. Acquires on mount if unset or expired, releases on unmount via onDisconnect. Prevents two devices entering fullscreen simultaneously.',
    webFiles: [
      'bk-web/features/remote/hooks/useFullscreenOwnership.ts',
    ],
  },
  {
    name: 'PlayNowButton',
    description: 'Host-only icon button. On press: removes the song from its current queue position and writes it to currentPlaying, stopping whatever was playing. Rendered inside QueueItemRow — only visible when isHost is true.',
    webFiles: [
      'bk-web/features/remote/components/PlayNowButton.tsx',
    ],
  },
  {
    name: 'IdleQRCode',
    description: 'QR code shown in the player screen when currentPlaying is null and the queue is empty. Points to the room join URL (NEXT_PUBLIC_SITE_URL + /?room=<roomCode>). Uses react-native-qrcode-svg on mobile (not qrcode.react).',
    webFiles: [
      'bk-web/components/IdleQRCode.tsx',
    ],
  },
  {
    name: 'NeonOrbs',
    description: 'Decorative background component. Renders 3-5 blurred circles with neon colours (purple, cyan, pink) that slowly drift using Animated.loop + Animated.timing. No Firebase dependency. Added to the join screen (app/join.tsx) as an absolute-positioned background layer.',
    webFiles: [
      'bk-web/features/remote/components/NeonOrbs.tsx',
    ],
  },
]
```

- [ ] **Step 2: Verify file still parses**

```bash
node --input-type=module < /Users/bason/Documents/bason-labs/bs-kara/.claude/workflows/web-mobile-sync.js 2>&1 | head -5
```

Expected: `ReferenceError: phase is not defined` (correct — schemas + FEATURES parsed, harness API not available outside runner).

- [ ] **Step 3: Commit**

```bash
cd /Users/bason/Documents/bason-labs/bs-kara && git add .claude/workflows/web-mobile-sync.js && git commit -m "feat(workflow): add FEATURES array for all 11 bk-web features"
```

---

## Task 3: Implement Phase 1 — Parallel reader agents

**Files:**
- Modify: `.claude/workflows/web-mobile-sync.js`

- [ ] **Step 1: Append Phase 1 after the FEATURES array**

```js
// ─── Phase 1: Parallel reader agents ───────────────────────────────────────

phase('Analyze')
log(`Reading ${FEATURES.length} bk-web features in parallel...`)

const specs = await parallel(FEATURES.map((feature) => () =>
  agent(
    `You are a READ-ONLY agent. Do NOT write any files.

Read the bk-web source files for the feature "${feature.name}" and produce a structured port spec for bk-mobile.

FEATURE: ${feature.name}
DESCRIPTION: ${feature.description}

BK-WEB FILES TO READ (paths from ${REPO}/):
${feature.webFiles.map((f) => `  - ${f}`).join('\n')}

Steps:
1. Read every file listed above using the Read tool.
2. Return a port spec with these fields:
   - feature: "${feature.name}" (exact string)
   - sourceFiles: the paths you read, relative from ${REPO} (e.g. "bk-web/hooks/useSongScore.ts")
   - targetFiles: [{path, action}] for every bk-mobile file to create or modify.
     Paths relative from ${REPO} (e.g. "bk-mobile/hooks/useSongScore.ts").
     action is "create" or "modify".
   - api: TypeScript signature as a plain string — the props interface + hook/component return type
   - firebasePaths: RTDB paths this feature reads/writes (e.g. ["rooms/{roomId}/reactions/{reactionId}"])
   - sharedDeps: symbols imported from @bs-kara/shared (e.g. ["db", "computeScore", "getRoomDataPath"])
   - rnAdaptations: specific React Native substitutions required, one per item:
       * "Replace qrcode.react QRCodeSVG with react-native-qrcode-svg QRCode"
       * "Replace CSS keyframe animation with RN Animated.loop + Animated.timing"
       * "Replace localStorage with AsyncStorage from @react-native-async-storage/async-storage"
       * "Replace window.location.origin with EXPO_PUBLIC_SITE_URL env var"
       * "Replace Web Speech API / browser SpeechSynthesis with expo-speech"
       (Add only the ones that actually apply to this feature)
   - webSourceContent: full source of every file you read, concatenated.
     Prefix each file with "// === FILE: <relative-path> ===" on its own line.

Return ONLY via StructuredOutput. Do not write to any file.`,
    { label: `read:${feature.name}`, phase: 'Analyze', schema: SPEC_SCHEMA }
  )
))

log('All specs ready. Starting sequential implementation...')
```

- [ ] **Step 2: Verify file parses**

```bash
node --input-type=module < /Users/bason/Documents/bason-labs/bs-kara/.claude/workflows/web-mobile-sync.js 2>&1 | head -5
```

Expected: `ReferenceError: phase is not defined` (correct).

- [ ] **Step 3: Commit**

```bash
cd /Users/bason/Documents/bason-labs/bs-kara && git add .claude/workflows/web-mobile-sync.js && git commit -m "feat(workflow): add Phase 1 parallel reader agents"
```

---

## Task 4: Implement Phase 2 — Sequential implement + verify loop

**Files:**
- Modify: `.claude/workflows/web-mobile-sync.js`

- [ ] **Step 1: Append Phase 2 after the Phase 1 block**

```js
// ─── Phase 2: Sequential implement + verify ────────────────────────────────

const results = []

for (let i = 0; i < FEATURES.length; i++) {
  const feature = FEATURES[i]
  const spec = specs[i]

  if (!spec) {
    log(`⚠️  Skipping ${feature.name} — reader returned null`)
    results.push({ feature: feature.name, passed: false, error: 'Reader agent returned null' })
    continue
  }

  log(`[${i + 1}/${FEATURES.length}] Implementing: ${feature.name}`)

  phase('Implement')
  await agent(
    `Implement the "${feature.name}" feature in bk-mobile. Port it from bk-web.

HARD CONSTRAINTS — any violation is a bug:
1. bk-web/ is READ-ONLY. Never create, edit, or delete any file under ${REPO}/bk-web/.
2. Only write files under ${REPO}/bk-mobile/.
3. Follow bk-mobile conventions:
   - Styling: NativeWind — use the "className" prop with Tailwind classes. No StyleSheet.create.
   - Navigation: Expo Router (router.push / router.replace). No React Navigation.
   - Bottom sheets: @gorhom/bottom-sheet BottomSheet component.
   - Animations: React Native Animated API (Animated.Value, Animated.timing, Animated.loop).
     No CSS, no framer-motion, no react-spring.
   - Storage: AsyncStorage from @react-native-async-storage/async-storage. No localStorage.
   - QR codes: react-native-qrcode-svg QRCode component. No qrcode.react.
   - Voice input: @react-native-voice/voice. No Web Speech API.
   - TTS: expo-speech as fallback when /api/tts fetch fails. No SpeechSynthesisUtterance.
4. Do not modify any file not listed in targetFiles.
5. When modifying an existing file, always read it with the Read tool first.

PORT SPEC:
Feature: ${spec.feature}
API: ${spec.api}
Firebase RTDB paths: ${(spec.firebasePaths || []).join(', ') || 'none'}
Shared imports (@bs-kara/shared): ${(spec.sharedDeps || []).join(', ') || 'none'}
RN adaptations required:
${(spec.rnAdaptations || []).map((a) => `  - ${a}`).join('\n') || '  (none)'}

TARGET FILES:
${spec.targetFiles.map((f) => `  ${f.action.toUpperCase()}: ${REPO}/${f.path}`).join('\n')}

BK-WEB SOURCE (reference — adapt for React Native, do not copy verbatim):
${spec.webSourceContent}

Implement now. Use Write for new files, Edit for modifications.`,
    { label: `implement:${feature.name}`, phase: 'Implement' }
  )

  phase('Verify')
  const verifyResult = await agent(
    `Verify bk-mobile compiles and lints cleanly after implementing "${feature.name}".

Run these commands in order:
1. cd ${REPO}/bk-mobile && npx tsc --noEmit 2>&1
2. cd ${REPO}/bk-mobile && npm run lint 2>&1

PASS condition: both commands exit with zero errors.
FAIL condition: either command has errors.

If FAIL on first run — attempt ONE self-repair:
  a. Read the error output carefully.
  b. Identify the specific lines causing errors.
  c. Fix only those lines using Edit. Do not touch files unrelated to "${feature.name}".
  d. Re-run BOTH commands.
  e. Report the result of the re-run (do not attempt a second repair).

Return:
  passed: true if both commands are error-free (after repair if needed), false otherwise
  errors: full error text if still failing, empty string "" if passed
  warnings: any non-blocking lint warnings (empty string "" if none)`,
    { label: `verify:${feature.name}`, phase: 'Verify', schema: VERIFY_SCHEMA }
  )

  if (!verifyResult || !verifyResult.passed) {
    const err = verifyResult && verifyResult.errors ? verifyResult.errors : 'Unknown verification error'
    log(`❌ Halted at [${i + 1}/${FEATURES.length}] ${feature.name}`)
    results.push({ feature: feature.name, passed: false, error: err })
    return { halted: true, haltedAt: feature.name, completedCount: i, results }
  }

  log(`✅ ${feature.name}${verifyResult.warnings ? ' (warnings present)' : ''}`)
  results.push({ feature: feature.name, passed: true, warnings: verifyResult.warnings || '' })
}
```

- [ ] **Step 2: Verify file parses**

```bash
node --input-type=module < /Users/bason/Documents/bason-labs/bs-kara/.claude/workflows/web-mobile-sync.js 2>&1 | head -5
```

Expected: `ReferenceError: phase is not defined` (correct — Phase 2 loop body references `specs` from Phase 1, both parse fine).

- [ ] **Step 3: Commit**

```bash
cd /Users/bason/Documents/bason-labs/bs-kara && git add .claude/workflows/web-mobile-sync.js && git commit -m "feat(workflow): add Phase 2 sequential implement+verify loop"
```

---

## Task 5: Implement Phase 3 — Summary agent

**Files:**
- Modify: `.claude/workflows/web-mobile-sync.js`

- [ ] **Step 1: Append Phase 3 after the Phase 2 block**

```js
// ─── Phase 3: Summary ──────────────────────────────────────────────────────

phase('Summary')

const passedCount = results.filter((r) => r.passed).length
const failedCount = results.filter((r) => !r.passed).length

const summaryLines = results.map((r) =>
  r.passed
    ? `- ✅ **${r.feature}**${r.warnings ? ' — lint warnings present' : ''}`
    : `- ❌ **${r.feature}** — ${r.error.slice(0, 300)}`
)

const nextSteps = failedCount > 0
  ? '- Review the failed features above.\n- Fix the reported errors manually in bk-mobile.\n- Re-run the workflow; completed features will be skipped if already verified.'
  : '- All features implemented.\n- Run the full bk-mobile test suite:\n  ```\n  cd bk-mobile && npm test\n  ```\n- Smoke-test the app on a simulator to confirm UI parity with bk-web remote.'

await agent(
  `Write a sync results report. Use the Write tool to create this file:

PATH: ${REPO}/docs/superpowers/sync-results.md

CONTENT (write exactly):

# bk-web → bk-mobile Sync Results

**Features attempted:** ${FEATURES.length}  
**Passed:** ${passedCount}  
**Failed:** ${failedCount}  

## Per-feature results

${summaryLines.join('\n')}

## Next steps

${nextSteps}

Write the file now. Do not modify any other file.`,
  { label: 'summary', phase: 'Summary' }
)

return { passed: passedCount, failed: failedCount, total: FEATURES.length, results }
```

- [ ] **Step 2: Verify complete file parses**

```bash
node --input-type=module < /Users/bason/Documents/bason-labs/bs-kara/.claude/workflows/web-mobile-sync.js 2>&1 | head -5
```

Expected: `ReferenceError: phase is not defined` — same as before, which means the whole script parsed without syntax errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/bason/Documents/bason-labs/bs-kara && git add .claude/workflows/web-mobile-sync.js && git commit -m "feat(workflow): add Phase 3 summary agent — workflow complete"
```

---

## Task 6: Run the workflow

**Files:**
- No source changes — this task runs the completed workflow.

- [ ] **Step 1: Confirm bk-mobile lint and typecheck pass on the unmodified codebase**

Before running, establish a green baseline:

```bash
cd /Users/bason/Documents/bason-labs/bs-kara/bk-mobile && npx tsc --noEmit 2>&1 | tail -5
```

```bash
cd /Users/bason/Documents/bason-labs/bs-kara/bk-mobile && npm run lint 2>&1 | tail -5
```

Both must be clean (exit 0 with no errors). If either has pre-existing errors, fix them before running the workflow — otherwise Phase 2 verification will false-fail on the first feature.

- [ ] **Step 2: Run the workflow**

In Claude Code, run:

```
workflow web-mobile-sync
```

Or equivalently, include the word "workflow" in a message and reference the script name.

Monitor the `/workflows` view for live progress across all phases.

- [ ] **Step 3: If the workflow halts at a feature**

The workflow returns `{ halted: true, haltedAt: "<feature name>", completedCount: N }`.

To diagnose:
1. Read the error in the workflow output or `docs/superpowers/sync-results.md`.
2. Manually fix the reported errors in the bk-mobile files for that feature.
3. Re-run the workflow. Completed features will re-run from Phase 1 (spec is regenerated) but verification is fast.

- [ ] **Step 4: On success, verify end-to-end**

```bash
cd /Users/bason/Documents/bason-labs/bs-kara/bk-mobile && npx tsc --noEmit && npm run lint && npm test
```

Expected: all pass. Check `docs/superpowers/sync-results.md` for the full per-feature report.

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Covered by |
|---|---|
| Phase 1: 11 parallel reader agents | Task 3 |
| Phase 2: sequential for-loop with implementer + verifier | Task 4 |
| Per-feature SPEC_SCHEMA structured output | Task 1 |
| Per-feature VERIFY_SCHEMA structured output | Task 1 |
| FEATURES array with exact bk-web paths | Task 2 |
| bk-web read-only constraint in every implementer prompt | Task 4 (HARD CONSTRAINTS block) |
| One self-repair attempt on verify failure | Task 4 (verifier prompt) |
| Halt on second failure, surface error | Task 4 (return statement) |
| Phase 3 summary report | Task 5 |
| RN adaptation substitution rules in implementer | Task 4 (conventions list) |

**Placeholder scan:** None found — all steps contain exact commands, exact file paths, and complete code blocks.

**Type consistency:** `SPEC_SCHEMA`, `VERIFY_SCHEMA`, `FEATURES`, `specs`, `results`, `verifyResult` — all names consistent across Tasks 1–5.
