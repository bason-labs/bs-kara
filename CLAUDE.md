# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # start dev server (localhost:3000)
npm run build        # production build
npm run start        # serve production build
npm run lint         # ESLint
npm run typecheck    # tsc --noEmit          (add to package.json if missing)
npm run test         # Vitest                (requires setup — see Testing Policy)
npm run test:e2e     # Playwright            (requires setup — see Testing Policy)
```

## Environment

`.env.local` must contain:
```
YOUTUBE_API_KEYS=<key1>,<key2>,<key3>   # server-side; comma-separated; rotated on 403
```

Optional legacy var: `NEXT_PUBLIC_YOUTUBE_API_KEY` is no longer used by the app (search now goes through the BFF at `/api/youtube/search`). Safe to remove.

## Architecture

This is a Next.js 15 (App Router) karaoke app with two distinct views:

**TV view** (`/tv`) — meant to run on a shared screen. Generates a random 4-digit room code client-side on mount and displays it fullscreen on a black background. No API calls; purely decorative for now.

**Remote view** (`/`) — the phone interface. Users enter the room code shown on the TV, then search YouTube and add songs to a local queue.

### Data flow

- YouTube search goes through a **BFF route** at `app/api/youtube/search/route.ts`. The server reads `YOUTUBE_API_KEYS` (comma-separated), rotates across them on 403, and wraps the call in `unstable_cache` with a 1h `revalidate`. The query is always suffixed with `"karaoke beat"`. Client code in `lib/youtube.ts → searchYouTube()` calls `/api/youtube/search` and falls back to the `yt-search` scraper at `/api/search` only if the BFF returns 429 (all keys exhausted) or 5xx.
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

---

## Testing Policy — Next.js + Vitest + Playwright

**Stack target:** Next.js (App Router), Vitest (unit / integration / component), Playwright (E2E).

### Setup status (delete this block once test infra is in place)

The repo does **not yet** have test infrastructure. Before applying the rules below, install:

```bash
# Vitest + Testing Library
npm i -D vitest @vitejs/plugin-react @testing-library/react @testing-library/jest-dom jsdom

# Playwright
npm i -D @playwright/test
npx playwright install
```

Then add config files (`vitest.config.ts`, `playwright.config.ts`) and the `test` / `test:e2e` / `typecheck` scripts to `package.json`. Until that is done, treat Rule 4 verification gates as best-effort: run whatever subset is available and clearly state what was skipped due to missing infra.

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