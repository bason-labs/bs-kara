# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # start dev server (localhost:3000)
npm run build    # production build
npm run start    # serve production build
npm run lint     # ESLint
```

No test suite is configured.

## Environment

`.env.local` must contain:
```
NEXT_PUBLIC_YOUTUBE_API_KEY=<YouTube Data API v3 key>
```

## Architecture

This is a Next.js 15 (App Router) karaoke app with two distinct views:

**TV view** (`/tv`) — meant to run on a shared screen. Generates a random 4-digit room code client-side on mount and displays it fullscreen on a black background. No API calls; purely decorative for now.

**Remote view** (`/`) — the phone interface. Users enter the room code shown on the TV, then search YouTube and add songs to a local queue.

### Data flow

- YouTube search happens **client-side** via `lib/youtube.ts → searchYouTube()`, which calls the YouTube Data API v3 directly from the browser using `NEXT_PUBLIC_YOUTUBE_API_KEY`. The query is always suffixed with `"karaoke beat"`.
- Autocomplete suggestions come from a **Next.js API route** (`/api/suggestions`) that proxies Google's suggest API (`suggestqueries.google.com`). This proxy exists to avoid CORS and to handle a charset encoding quirk: Google returns `ISO-8859-1` but declares it inconsistently, so the route decodes the raw bytes as latin-1 before passing to `JSON.parse`. Suggestions are debounced 300 ms in `SearchPanel`.
- The **queue is local state** in `app/page.tsx` — there is no real-time sync between the phone and the TV yet.

### Key types (`lib/youtube.ts`)

```ts
YouTubeVideo  { id, title, channel, thumbnail, duration }
QueueItem     extends YouTubeVideo + { queueId }   // queueId = `${id}-${Date.now()}`
```

### Component responsibilities

- `app/page.tsx` — room join gate + main remote shell; owns the `queue` state
- `app/components/SearchPanel.tsx` — search input with suggestion dropdown + results list; calls `onAdd` prop
- `app/components/ClientQueue.tsx` — read-only queue sidebar; receives items as props
- `app/tv/page.tsx` — TV display; self-contained, no shared state
