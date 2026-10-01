# CLAUDE.md — apps/web

Loaded when working under `apps/web/`. Repo-wide rules (commits, testing) are in the root `CLAUDE.md`.

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

### Where code goes

- `apps/web/app/api/` route handlers stay thin: parse the request, call `server/`, map the response.
- Server code used by one feature lives in `features/<name>/server/`; server-only code shared across routes lives in `server/`.
- `lib/` holds client-safe helpers only; `hooks/` and `components/` are for code shared across features.
