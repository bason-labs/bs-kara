# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commit conventions

Commit messages must contain ONLY a Conventional Commits subject and an
optional body that describes the change. The sole author must be the user.

DO NOT add any of the following to commit messages:
- `Co-Authored-By: Claude` (or any other Claude / Anthropic identity)
- `🤖 Generated with Claude Code` (or any variant)
- Any trailer, signature, or footer attributing the commit to Claude or
  Anthropic

This applies to every `git commit` (and amend / rebase) made in this
repository — no exceptions, even when the user explicitly approves a
change. If unsure, omit attribution.

## Commands

```bash
pnpm dev               # web dev server (turbo dev --filter=@bs-kara/web)
pnpm build             # production build (turbo build)
pnpm lint              # ESLint (turbo lint)
pnpm test              # Vitest, all workspaces (turbo test)
pnpm -C apps/web run typecheck      # tsc --noEmit for the web app
pnpm -C apps/web run test:rules     # Firebase rules suite (needs the emulator)
```

## Environment

Web: `apps/web/.env.local` (often a symlink to the repo-root `.env.local`). Required:

```
YOUTUBE_API_KEYS=<key1>,<key2>,<key3>     # server-side; comma-separated; rotated on 403
GOOGLE_TTS_API_KEY=<key>                  # server-side; Google Cloud TTS for MC playback
OPENAI_API_KEY=<key>                      # server-side; AI MC lines + voice chat agent
GEMINI_API_KEY=<key>                      # server-side; AI MC fallback
NEXT_PUBLIC_FIREBASE_API_KEY=<...>        # client; Firebase web config
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=<...>
NEXT_PUBLIC_FIREBASE_DATABASE_URL=<...>
NEXT_PUBLIC_FIREBASE_PROJECT_ID=<...>
NEXT_PUBLIC_FIREBASE_APP_ID=<...>
```

Optional (a missing value disables only that feature):

- `FIREBASE_ADMIN_PROJECT_ID`, `FIREBASE_ADMIN_CLIENT_EMAIL`, `FIREBASE_ADMIN_PRIVATE_KEY` — Firebase Admin for the admin area, subscriptions, analytics and voice chat
- `ADMIN_EMAILS` — comma-separated allow-list for `/admin`
- `AI_MC_PROVIDER` — `openai` (default) or `gemini`
- `NEXT_PUBLIC_ADMIN_TRIAL_DEFAULT_DAYS` — default trial length in the admin subscription form
- `NEXT_PUBLIC_FIXED_ROOM_ID` — pins the TV to a specific room code instead of claiming via the active-room pointer (debug)
- `NEXT_PUBLIC_PUBLIC_ORIGIN` — origin for QR/join links, e.g. a dev tunnel (defaults to `window.location.origin`)
- `NEXT_PUBLIC_SITE_URL` — absolute base URL for metadata, robots and sitemap, read in `lib/siteUrl.ts` (defaults to `http://localhost:3000`)

Mobile: `apps/mobile/.env` holds the same Firebase config as `EXPO_PUBLIC_FIREBASE_*`, plus
`EXPO_PUBLIC_API_BASE_URL` (the web app's origin, for the API routes). Both apps read the
Firebase config through `packages/shared/src/lib/firebaseConfig.ts`.

## Architecture

This is a Next.js 16 (App Router) karaoke app with two distinct views, both backed by Firebase Realtime Database:

**TV view** (`/tv`) — meant to run on a shared screen. Claims (or attaches to) the active room on mount, displays a QR code in a waiting overlay until the first user gesture, plays the YouTube embed for `currentPlaying`, runs the AI MC announcement before each song, and can soft-reset the room ("End Party"). Sets `isTvActive` Firebase presence (with `onDisconnect` cleanup) so phones can hide their duplicate now-playing card while the TV is on.

**Remote view** (`/`) — the phone interface. Mobile devices auto-join whichever room the active-room pointer references; desktops see an OTP form gated on the same pointer. Phones can search YouTube, add songs (with optional requester name), reorder/remove queue items, send emoji reactions, configure the room (auto-random + filters, MC voice, drag-drop, requester prompt), and open a fullscreen player when the TV is offline.

### Data flow

- **Firebase Realtime Database** is the source of truth for all room state. The shape is mirrored in `RoomState` (`packages/shared/src/hooks/useRoom/types.ts`): queue, currentPlaying, history, playedHistory, isPlaying, settings (auto-random + filters, drag-drop, requester prompt, MC + voice), `lastAnnouncedSongId` (cross-device MC lock), `isTvActive` (TV presence), `lastEndedAt` (End Party marker).
- **Active-room pointer** at `meta/activeRoom` (`packages/shared/src/lib/activeRoom.ts`) is a single Firebase node holding the currently-claimed room code. `claimOrGetActiveRoom()` does an atomic `runTransaction` claim. The TV claims on mount; mobile phones auto-attach; desktops join via OTP.
- **YouTube search** goes through a BFF route at `app/api/youtube/search/route.ts`, backed by `server/youtube.ts`. Reads `YOUTUBE_API_KEYS` (comma-separated), rotates on 403, wraps the call in `unstable_cache` with a 1h `revalidate`, and suffixes the query with `"karaoke beat"`. Cache key is normalised by `normalizeDiacritics` (`packages/shared/src/lib/text/normalize.ts`) plus a whitespace collapse. Client code in `lib/youtube/client.ts → searchYouTube()` calls the BFF and falls back to the `yt-search` scraper at `/api/search` only on 429 (quota exhausted) or 5xx.
- **Autocomplete suggestions** come from `/api/suggestions`, which proxies Google's `suggestqueries.google.com`. Exists to avoid CORS and to handle a charset quirk: Google returns ISO-8859-1 but declares it inconsistently, so the route decodes raw bytes as latin-1 before `JSON.parse`. Suggestions are debounced 300 ms in `useSearchSuggestions`.
- **AI MC announcements**: when a song hits the queue (or `currentPlaying`), `/api/generate-mc` is asked for a one-line MC intro (`server/mc/`: OpenAI by default, Gemini via `AI_MC_PROVIDER`, template fallback on any error). The text is written onto the queue node, or onto `currentPlaying` if the song already promoted. `useMCPlayer` then gates the iframe (mute + pause), claims `lastAnnouncedSongId` atomically (so only one device speaks across TV + phone), and plays via Google TTS at `/api/tts` (`server/tts.ts`). When the gate releases, VideoPlayer's `isPlaying` prop flips false→true and resumes the iframe; no extra Firebase write is needed.
- **Auto-random**: when `isAutoRandomMode` is on and the queue is empty + nothing playing, `useAutoRandom` picks from a curated song pool (`packages/shared/src/lib/random/`) honouring genre/type/tone filters, hits the BFF, and writes the result straight to `currentPlaying`. Both TV and phone can drive it; an internal busy ref + a Firebase-snapshot guard prevents double-writes.

### Key types (`packages/shared/src/lib/youtube/types.ts`)

```ts
YouTubeVideo  { id, title, channel, thumbnail, duration, requesterName?, mcText? }
QueueItem     extends YouTubeVideo + { queueId }   // queueId = Firebase push() key
RandomFilters { type: 'all'|'solo'|'duet'; tone: 'all'|'male'|'female'; genre: 'all'|'bolero'|'caco'|'tre' }
```

### Top-level layout

```
apps/
  web/                  Next.js App Router (@bs-kara/web); paths below are relative to it
    app/                routes: page.tsx (remote), tv/, admin/, register/;
                        api/ route handlers stay thin (parse request, call server/, map response)
    features/           remote/, tv/, admin/, register/, voice/ — components/ + hooks/,
                        plus server/ when the server code belongs to one feature (voice)
    server/             server-only modules shared across routes: firebaseAdmin,
                        admin/requireAdmin, youtube (BFF search + key rotation), analytics,
                        subscriptions/ (repo, paths, roomAccess), mc/ (AI MC lines), tts
    hooks/              cross-feature client hooks (useMCPlayer, useAutoRandom, useAIVoice,
                        useAdMask, useAutoHide, useSongScore, useScrollOffset)
    components/         cross-feature presentational components (VideoPlayer, EmojiLayer,
                        ConfirmDialog, MCAnnouncementOverlay, ThemeProvider, …)
    lib/                client-safe helpers: youtube/ (client + types), subscriptions/
                        (schema, phone, expiry), roomAccess (API contract), logger, siteUrl, …
    tests/              Vitest setup, MSW handlers, stubs, Firebase rules suite
  mobile/               Expo Router app (@bs-kara/mobile): app/, components/, hooks/,
                        context/, features/settings
packages/
  shared/               @bs-kara/shared: Firebase client + room paths, useRoom and
                        useTransientNotice, i18n + locales, scoring, random picker, reactions,
                        YouTube types
docs/                   proposals/, specs and plans
```

### Component responsibilities (high-level)

- `features/remote/RemoteClient.tsx` — composition shell. Wires `useRoomGate` (URL ↔ room contract, localStorage persistence, mobile auto-claim), `useRoom` (Firebase state + mutations), `useAutoRandom`, `useRequesterDialog` (add/edit name + post-add toast), `useQueuedMap`, layout, tab nav, and mobile/desktop branching.
- `features/remote/components/SearchPanel.tsx` — search input + suggestion dropdown + voice search modal + results list. Composes `useHotHits`, `useSearchHistory`, `useSearchSuggestions`, `useVoiceSearch` from `features/remote/hooks/`.
- `features/remote/components/SettingsSheet/` — bottom sheet split into sections (`AutoRandomSection`, `QueueSection`, `AIMcSection`, `ThemeSection`, `RoomSection`) sharing primitives (`ToggleRow`, `FilterRow`, `SectionHeader`). `VoicePicker` renders the MC voice radio cards with live audio preview.
- `features/remote/components/ClientQueue.tsx` — read-only queue with optional drag-and-drop (gated on `dragDropEnabled`).
- `features/remote/components/FullscreenPlayer.tsx` — phone fullscreen player; only used when the TV is offline.
- `features/remote/components/JoinForm.tsx` — desktop OTP form; gated on the active-room pointer.
- `features/tv/TVClient.tsx` — composition shell. Uses `useTVPresence` (room claim + isTvActive presence with `onDisconnect`), `useEndParty` (confirm + reset + 5s toast), `useRoom`, `useAutoRandom`, `useMCPlayer`. Renders `<BackdropLayers />`, `<WaitingOverlay />`, the inline video section, and `<QueuePanel />`.

### Useful shared hooks

- `useRoom(roomId)` — composed of `subscribe`, `queue`, `history`, `mc`, `settings` sub-hooks under `packages/shared/src/hooks/useRoom/`. Returns the full `RoomState` plus all mutators. Public import: `@bs-kara/shared/hooks`.
- `useTransientNotice(durationMs)` — self-clearing toast hook used by both `RemoteClient` and `TVClient` (`@bs-kara/shared/hooks`).

---

## Testing

Vitest + Testing Library + MSW. Test behaviour that can break silently; skip the rest.

- **Test:** server code (`server/`), route handlers, hooks with state or effects, pure helpers
  with branches (parsing, validation, key rotation, fallbacks).
- **Don't test:** presentational components, config, thin glue, copy/styling, types.
- **Bug fix:** add one test that fails without the fix. Name it after the bug
  (`it('does not <bug> when <trigger>')`).
- **Keep tests small:** one test per behaviour; use `it.each` for input/output variants instead of
  copy-pasted tests. Mock dependencies (`fetch`, Firebase, APIs), never the unit under test.
- **Never** commit `.only`/`.skip`, weaken an assertion to go green, or delete a failing test
  without asking.

Before calling a change done, run and report:

```bash
pnpm exec turbo run build --filter=@bs-kara/web   # first: regenerates .next/types for tsc
pnpm exec turbo run typecheck lint test
```

If any step fails, stop and report it; don't skip or loosen tests to get green.
