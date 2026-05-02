# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # start dev server (localhost:3000)
npm run build        # production build
npm run start        # serve production build
npm run lint         # ESLint
npx tsc --noEmit     # typecheck (no dedicated script)
npm run test         # Vitest (one-shot)
npm run test:watch   # Vitest watch
npm run test:e2e     # Playwright
```

## Environment

`.env.local` must contain:

```
YOUTUBE_API_KEYS=<key1>,<key2>,<key3>     # server-side; comma-separated; rotated on 403
GOOGLE_TTS_API_KEY=<key>                  # server-side; Google Cloud TTS for MC playback
OPENAI_API_KEY=<key>                      # server-side; AI MC line generation (default provider)
GEMINI_API_KEY=<key>                      # server-side; AI MC fallback
NEXT_PUBLIC_FIREBASE_API_KEY=<...>        # client; Firebase web config
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=<...>
NEXT_PUBLIC_FIREBASE_DATABASE_URL=<...>
NEXT_PUBLIC_FIREBASE_PROJECT_ID=<...>
NEXT_PUBLIC_FIREBASE_APP_ID=<...>
```

Optional:

- `AI_MC_PROVIDER` — `openai` (default) or `gemini`
- `NEXT_PUBLIC_FIXED_ROOM_ID` — pins the TV to a specific room code instead of claiming via the active-room pointer (debug)
- `NEXT_PUBLIC_SITE_URL` — used by `app/sitemap.ts`, `app/robots.ts`, `app/layout.tsx` for absolute URLs (defaults to `http://localhost:3000`)

Legacy: `NEXT_PUBLIC_YOUTUBE_API_KEY` is no longer used (search goes through the BFF). Safe to remove.

## Architecture

This is a Next.js 15 (App Router) karaoke app with two distinct views, both backed by Firebase Realtime Database:

**TV view** (`/tv`) — meant to run on a shared screen. Claims (or attaches to) the active room on mount, displays a QR code in a waiting overlay until the first user gesture, plays the YouTube embed for `currentPlaying`, runs the AI MC announcement before each song, and can soft-reset the room ("End Party"). Sets `isTvActive` Firebase presence (with `onDisconnect` cleanup) so phones can hide their duplicate now-playing card while the TV is on.

**Remote view** (`/`) — the phone interface. Mobile devices auto-join whichever room the active-room pointer references; desktops see an OTP form gated on the same pointer. Phones can search YouTube, add songs (with optional requester name), reorder/remove queue items, send emoji reactions, configure the room (auto-random + filters, MC voice, drag-drop, requester prompt), and open a fullscreen player when the TV is offline.

### Data flow

- **Firebase Realtime Database** is the source of truth for all room state. The shape is mirrored in `RoomState` (`hooks/useRoom/types.ts`): queue, currentPlaying, history, playedHistory, isPlaying, settings (auto-random + filters, drag-drop, requester prompt, MC + voice), `lastAnnouncedSongId` (cross-device MC lock), `isTvActive` (TV presence), `lastEndedAt` (End Party marker).
- **Active-room pointer** at `meta/activeRoom` (`lib/activeRoom.ts`) is a single Firebase node holding the currently-claimed room code. `claimOrGetActiveRoom()` does an atomic `runTransaction` claim. The TV claims on mount; mobile phones auto-attach; desktops join via OTP.
- **YouTube search** goes through a BFF route at `app/api/youtube/search/route.ts`. Reads `YOUTUBE_API_KEYS` (comma-separated), rotates on 403, wraps the call in `unstable_cache` with a 1h `revalidate`, and suffixes the query with `"karaoke beat"`. Cache key is normalised by `lib/text/normalize.ts → normalizeDiacritics` plus a whitespace collapse. Client code in `lib/youtube/client.ts → searchYouTube()` calls the BFF and falls back to the `yt-search` scraper at `/api/search` only on 429 (quota exhausted) or 5xx.
- **Autocomplete suggestions** come from `/api/suggestions`, which proxies Google's `suggestqueries.google.com`. Exists to avoid CORS and to handle a charset quirk: Google returns ISO-8859-1 but declares it inconsistently, so the route decodes raw bytes as latin-1 before `JSON.parse`. Suggestions are debounced 300 ms in `useSearchSuggestions`.
- **AI MC announcements**: when a song hits the queue (or `currentPlaying`), `app/api/generate-mc/route.ts` is asked for a one-line MC intro (OpenAI by default, Gemini fallback via `AI_MC_PROVIDER`). The text is written onto the queue node, or onto `currentPlaying` if the song already promoted. `useMCPlayer` then gates the iframe (mute + pause), claims `lastAnnouncedSongId` atomically (so only one device speaks across TV + phone), and plays via Google TTS at `/api/tts`. After the announcement, `useMCKickPlay` flips `isPlaying` back on at the gated → ungated edge.
- **Auto-random**: when `isAutoRandomMode` is on and the queue is empty + nothing playing, `useAutoRandom` picks from a curated song pool (`lib/random/`) honouring genre/type/tone filters, hits the BFF, and writes the result straight to `currentPlaying`. Both TV and phone can drive it; an internal busy ref + a Firebase-snapshot guard prevents double-writes.

### Key types (`lib/youtube/types.ts`)

```ts
YouTubeVideo  { id, title, channel, thumbnail, duration, requesterName?, mcText? }
QueueItem     extends YouTubeVideo + { queueId }   // queueId = Firebase push() key
RandomFilters { type: 'all'|'solo'|'duet'; tone: 'all'|'male'|'female'; genre: 'all'|'bolero'|'caco'|'tre' }
```

### Top-level layout

```
app/                    Next.js App Router
  api/                  route handlers: youtube/search, search (yt-search fallback),
                        suggestions, generate-mc, tts
  page.tsx              wraps <RemoteClient />
  tv/page.tsx           wraps <TVClient />
features/
  remote/               phone-side feature: RemoteClient + components/ + hooks/
  tv/                   TV-side feature: TVClient + components/ + hooks/
hooks/                  shared hooks (useRoom — split into a folder by concern,
                        useAutoRandom, useMCPlayer, useMCKickPlay, useTransientNotice,
                        useAIVoice, useAutoHide)
components/             cross-feature presentational components (VideoPlayer,
                        EmojiLayer, ConfirmDialog, MCAnnouncementOverlay, ThemeProvider)
lib/                    firebase, activeRoom pointer, config, i18n, logger, reactions,
                        random/ (auto-random picker + song pools), text/ (normalize),
                        youtube/ (client + types)
locales/                en + vi i18n bundles (react-i18next)
e2e/                    Playwright specs
tests/                  Vitest setup + MSW handlers
```

### Component responsibilities (high-level)

- `features/remote/RemoteClient.tsx` — composition shell. Wires `useRoomGate` (URL ↔ room contract, localStorage persistence, mobile auto-claim), `useRoom` (Firebase state + mutations), `useAutoRandom`, `useRequesterDialog` (add/edit name + post-add toast), `useQueuedMap`, layout, tab nav, and mobile/desktop branching.
- `features/remote/components/SearchPanel.tsx` — search input + suggestion dropdown + voice search modal + results list. Composes `useHotHits`, `useSearchHistory`, `useSearchSuggestions`, `useVoiceSearch` from `features/remote/hooks/`. Renders `<AddToQueueButton />` per result.
- `features/remote/components/SettingsSheet/` — bottom sheet split into sections (`AutoRandomSection`, `QueueSection`, `AIMcSection`, `ThemeSection`, `RoomSection`) sharing primitives (`ToggleRow`, `FilterRow`, `SectionHeader`). `VoicePicker` renders the MC voice radio cards with live audio preview.
- `features/remote/components/ClientQueue.tsx` — read-only queue with optional drag-and-drop (gated on `dragDropEnabled`).
- `features/remote/components/FullscreenPlayer.tsx` — phone fullscreen player; only used when the TV is offline.
- `features/remote/components/JoinForm.tsx` — desktop OTP form; gated on the active-room pointer.
- `features/tv/TVClient.tsx` — composition shell. Uses `useTVPresence` (room claim + isTvActive presence with `onDisconnect`), `useEndParty` (confirm + reset + 5s toast), `useRoom`, `useAutoRandom`, `useMCPlayer`, `useMCKickPlay`. Renders `<BackdropLayers />`, `<WaitingOverlay />`, the inline video section, and `<QueuePanel />`.

### Useful shared hooks

- `useRoom(roomId)` — composed of `subscribe`, `queue`, `history`, `mc`, `settings` sub-hooks under `hooks/useRoom/`. Returns the full `RoomState` plus all mutators. Public import: `@/hooks/useRoom`.
- `useTransientNotice(durationMs)` — self-clearing toast hook used by both `RemoteClient` and `TVClient`.
- `useMCKickPlay(isMcGated, isPlaying, setPlaying)` — flips playback back on at the gated → ungated edge; shared between TV and phone fullscreen player.

---

## Testing Policy — Next.js + Vitest + Playwright

**Stack target:** Next.js (App Router), Vitest (unit / integration / component), Playwright (E2E). Both are configured and wired into `package.json` (`test`, `test:watch`, `test:coverage`, `test:e2e`, `test:e2e:ui`).

### Rule 1 — Bug fixes require a regression test (NEVER skip)

When fixing any bug, you MUST:

1. FIRST write a failing test that reproduces the bug (red)
2. THEN apply the fix (green)
3. Confirm the test would have caught the original bug — state this explicitly
4. Name the test so the bug is obvious: `it('does not <bug behavior> when <trigger>')`
5. If the bug came from a GitHub issue, ticket, or commit, reference it in a comment above the test

Pick the right layer:

- Logic / utility / hook / server action / route handler → **Vitest**
- React component with state or conditional rendering → **Vitest + Testing Library**
- User-facing flow (room-code entry, search, add-to-queue, TV view) → **Playwright**

NEVER ship a bug fix without a regression test. If a fix is genuinely untestable (pure styling, dependency bump with no logic change, copy update), STOP and tell me why before proceeding.

### Rule 2 — Source changes require meaningful test coverage

When you add, modify, or remove source code:

- **New function / hook / server action / route handler / utility** → MUST add tests covering the meaningful behaviors. Don't blindly aim for a fixed count — judge by branching. At minimum: the main use case, plus any non-trivial branch (validation, errors, auth checks, empty states, the YouTube key-rotation logic).
- **New React component with logic** (state, effects, conditional rendering) → MUST test the logic, not the markup. Skip tests for purely presentational components.
- **Modified behavior** → MUST update existing tests AND add a test for the new behavior.
- **Removed code** → MUST remove its tests in the same change.
- **Refactor with no behavior change** → existing tests MUST still pass unchanged. If they don't, the refactor changed behavior — stop and flag it.

Tests can be skipped only for: pure presentational components, type-only changes, comment/doc updates, copy changes.

### Rule 3 — Next.js-specific config and infra changes

When you change any of the following, treat as high-risk:

- `next.config.{js,ts,mjs}` — redirects, rewrites, headers, image domains, experimental flags
- `middleware.ts` — auth, redirects, header injection
- `app/**/route.ts` (route handlers) — including `/api/youtube/search`, `/api/suggestions`, `/api/search`
- Server actions (functions marked `'use server'`)
- Env schema and `.env.local` keys (e.g. `YOUTUBE_API_KEYS`)
- `vitest.config.ts`, `playwright.config.ts`
- `package.json` scripts, `tsconfig.json` paths / aliases

Requirements:

- MUST run the full test suite locally and confirm green before declaring done
- For **route handler** changes: MUST add a Vitest test for the handler logic AND a Playwright test if it affects a user-facing flow
- For **env vars**: MUST validate at startup (e.g. with zod) AND add a test that fails clearly when the var is missing or malformed. For `YOUTUBE_API_KEYS` specifically: test the comma-split, the rotation-on-403 logic, and the 429 exhaustion fallback.
- For **redirects / rewrites** in `next.config`: MUST add a Playwright test asserting the redirect

### Rule 4 — Verification gates

#### Fast checks (after every meaningful change)

Run in this order and report each result:

1. Typecheck — MUST pass
2. Lint — MUST pass
3. Vitest — MUST pass, no `.skip`, no `.todo`, no `.only`

Output:

```
✅ typecheck
✅ lint
✅ vitest (N tests)
```

#### Full checks (before declaring a task complete)

4. Playwright E2E — MUST pass for any flow touched by the change
5. `next build` — MUST pass

Output:

```
✅ playwright (N tests)
✅ build
```

If ANY step fails, STOP. Do not "fix" by skipping tests, loosening assertions, or commenting things out. Surface the failure and ask.

### Rule 5 — Test quality bar (NEVER violate)

- NEVER use `.skip`, `.todo`, `xit`, `xdescribe`, `it.only`, or `test.only` in committed code
- NEVER weaken an assertion to make a test pass (e.g. `toBeTruthy` instead of `toEqual(expected)`)
- NEVER catch and swallow errors in tests to make them green
- NEVER delete a failing test without explicit permission — failing tests are signal, not noise
- NEVER add `expect(true).toBe(true)` or empty test bodies as placeholders
- NEVER mock the thing you are testing. Mock its dependencies (e.g. `fetch`, the YouTube API), not itself.
- In Playwright: NEVER use arbitrary `page.waitForTimeout(ms)`. Use `waitFor`, `toBeVisible`, web-first assertions, or proper locators tied to actual app state.
- In Vitest with Testing Library: prefer `getByRole` / `getByLabelText` over `getByTestId`. Test IDs are a last resort.

### Rule 6 — Reporting

For every change you make, end your response with:

**Files changed (source):**
- `path/to/file.ts` — what changed

**Files changed (tests):**
- `path/to/file.test.ts` — what it covers

**Why each test exists (one line each):**
- `<test name>` — <reason>

If "Files changed (tests)" is empty for a non-trivial change, you MUST explicitly justify why. Default assumption: every change needs a test.
