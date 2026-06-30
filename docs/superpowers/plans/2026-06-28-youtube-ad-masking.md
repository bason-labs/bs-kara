# YouTube Ad Masking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On the shared TV and the phone fullscreen player, detect when an ad is
playing inside the YouTube embed, mute it and cover it with a branded
"intermission" overlay, then auto-restore the moment the real song resumes.

**Architecture:** A signal probe `detectAd(player, requestedVideoId)` compares
the id in `player.getVideoUrl()` to the requested video id (mismatch ⇒ ad). A
hook `useAdMask` polls that probe at 250 ms with debounce + a 45 s safety cap and
returns `{ isAdGated }`. The TV and fullscreen wrappers OR this with the existing
MC gate to drive volume to 0 and paint a new `AdIntermissionOverlay`. The
`VideoPlayer` itself is untouched — it already mutes on `volume === 0`.

**Tech Stack:** Next.js 15 (App Router), React, TypeScript, `react-youtube`
(over the `youtube-player` wrapper), Vitest + Testing Library, react-i18next.

## Global Constraints

- Commit messages: Conventional Commits subject + optional body only. **NO
  Claude/Anthropic attribution** (no `Co-Authored-By`, no "Generated with").
- ToS-compliant: keep the official IFrame player. Do **not** skip/remove ads.
- Detection signal is `getVideoUrl()` id-mismatch only — `getVideoData()` is NOT
  reachable through the wrapper, and no stored song duration exists
  (`bk-web/app/api/youtube/search/route.ts:98` hardcodes `duration: ''`).
- MC gate takes precedence over the ad gate when both could be active.
- Test quality: no `.skip`/`.only`/`.todo`; no weakened assertions; prefer
  `getByRole`/`getByText` over `getByTestId`.
- Verification order (fast): typecheck → lint → vitest. Full: build (+ existing
  Playwright suite must still pass).
- Commands: `pnpm -C bk-web run typecheck`, `pnpm -C bk-web run lint`,
  `pnpm -C bk-web run test`, `pnpm build`.

---

## Task 1: Phase 0 validation spike (decision-gating, throwaway)

**This task gates the rest.** If `getVideoUrl()` does NOT change while an ad
plays, the primary signal is invalid — STOP and report back before Task 2.

**Files:**
- Temporarily modify: `bk-web/features/tv/TVClient.tsx` (instrumentation only —
  reverted at the end of this task; nothing committed)
- Update: `docs/superpowers/specs/2026-06-28-youtube-ad-masking-design.md`
  (append a "Phase 0 findings" subsection)

**Interfaces:**
- Consumes: nothing.
- Produces: a recorded decision (go / no-go) + observed `getVideoUrl()` behavior
  during ads, written into the spec. No code artifacts.

- [ ] **Step 1: Add temporary instrumentation**

In `bk-web/features/tv/TVClient.tsx`, inside the existing component body (after
`ytPlayer` is available via `setYtPlayer`), add a throwaway effect:

```tsx
// TEMP SPIKE — remove before commit. Logs what the player reports so we can
// confirm getVideoUrl() reflects ads.
useEffect(() => {
  if (!ytPlayer) return;
  const id = window.setInterval(() => {
    try {
      // eslint-disable-next-line no-console
      console.log('[ad-spike]', {
        state: ytPlayer.getPlayerState(),
        url: ytPlayer.getVideoUrl(),
        duration: ytPlayer.getDuration(),
        current: ytPlayer.getCurrentTime(),
      });
    } catch (e) {
      // eslint-disable-next-line no-console
      console.log('[ad-spike] threw', e);
    }
  }, 1000);
  return () => window.clearInterval(id);
}, [ytPlayer]);
```

- [ ] **Step 2: Run a real ad-bearing video on the TV**

Run: `pnpm dev`. Open `/tv`, activate a room, and from a phone queue a video
known to run ads (a popular monetized music video works; karaoke beats often do
not — pick one that does). Watch the browser console for `[ad-spike]` lines
during the pre-roll ad and again once the song starts.

Expected (go): during the ad, `url` shows a DIFFERENT `v=` id (or is empty/non-
watch); once the song plays, `url`'s `v=` id equals the queued video id. `state`
is `1` (PLAYING) during both.

- [ ] **Step 3: Record findings in the spec**

Append a `### Phase 0 findings` subsection to
`docs/superpowers/specs/2026-06-28-youtube-ad-masking-design.md` stating: whether
`getVideoUrl()` changed during the ad, what it returned (different id vs empty),
and the resulting decision. If it returned EMPTY (not a different id) during ads,
note that Task 2 must treat "empty URL while PLAYING" as an ad (see Task 2
Step 3 note).

- [ ] **Step 4: Revert the instrumentation**

Remove the TEMP SPIKE effect from `TVClient.tsx`. Confirm the file matches
`origin/main` for that region.

Run: `git diff --stat bk-web/features/tv/TVClient.tsx`
Expected: no changes (spike fully reverted).

- [ ] **Step 5: Commit the findings only**

```bash
git add docs/superpowers/specs/2026-06-28-youtube-ad-masking-design.md
git commit -m "docs: record Phase 0 ad-detection spike findings"
```

---

## Task 2: `detectAd` signal probe

**Files:**
- Create: `bk-web/hooks/useAdMask.ts` (probe only in this task)
- Test: `bk-web/hooks/useAdMask.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `interface AdMaskPlayer { getPlayerState: () => number; getVideoUrl: () => string; }`
  - `parseVideoId(url: string): string | null`
  - `detectAd(player: AdMaskPlayer, requestedVideoId: string): boolean`

- [ ] **Step 1: Write the failing tests**

Create `bk-web/hooks/useAdMask.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { detectAd, parseVideoId } from './useAdMask';

const SONG = 'songId123';
const playing = (url: string) => ({
  getPlayerState: () => 1, // YT PLAYING
  getVideoUrl: () => url,
});

describe('parseVideoId', () => {
  it('extracts the v= id from a watch URL', () => {
    expect(parseVideoId('https://www.youtube.com/watch?v=abc123&t=4')).toBe('abc123');
  });
  it('returns null for an empty or non-watch URL', () => {
    expect(parseVideoId('')).toBeNull();
    expect(parseVideoId('https://www.youtube.com/')).toBeNull();
  });
});

describe('detectAd', () => {
  it('reports an ad when PLAYING and the url id differs from the requested id', () => {
    expect(detectAd(playing('https://www.youtube.com/watch?v=adXYZ'), SONG)).toBe(true);
  });
  it('reports no ad when the url id matches the requested id', () => {
    expect(detectAd(playing(`https://www.youtube.com/watch?v=${SONG}`), SONG)).toBe(false);
  });
  it('reports no ad when the player is not PLAYING', () => {
    const paused = { getPlayerState: () => 2, getVideoUrl: () => 'https://www.youtube.com/watch?v=adXYZ' };
    expect(detectAd(paused, SONG)).toBe(false);
  });
  it('reports no ad on an empty / unparseable url', () => {
    expect(detectAd(playing(''), SONG)).toBe(false);
  });
  it('reports no ad when requestedVideoId is empty', () => {
    expect(detectAd(playing('https://www.youtube.com/watch?v=adXYZ'), '')).toBe(false);
  });
  it('swallows getter errors and reports no ad', () => {
    const thrower = {
      getPlayerState: () => { throw new Error('teardown'); },
      getVideoUrl: () => '',
    };
    expect(detectAd(thrower, SONG)).toBe(false);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm -C bk-web run test useAdMask`
Expected: FAIL — `detectAd`/`parseVideoId` are not exported (module/throws).

- [ ] **Step 3: Implement the probe**

Create `bk-web/hooks/useAdMask.ts`:

```ts
// Minimal player surface useAdMask depends on. The real react-youtube player
// exposes far more; narrowing keeps the unit-test fakes tiny.
export interface AdMaskPlayer {
  getPlayerState: () => number;
  getVideoUrl: () => string;
}

// YT.PlayerState.PLAYING === 1.
const YT_PLAYING = 1;

// Pull the v= id out of a watch URL. Returns null when the URL is empty or has
// no parseable id.
export function parseVideoId(url: string): string | null {
  if (!url) return null;
  const match = url.match(/[?&]v=([^&]+)/);
  return match ? match[1] : null;
}

// True when an ad is *likely* on screen: the player is PLAYING but the id in
// getVideoUrl() differs from the song we asked for. Fail-safe: any throw,
// non-PLAYING state, or unparseable URL returns false (never a false ad).
export function detectAd(player: AdMaskPlayer, requestedVideoId: string): boolean {
  if (!requestedVideoId) return false;
  try {
    if (player.getPlayerState() !== YT_PLAYING) return false;
    const playingId = parseVideoId(player.getVideoUrl());
    if (!playingId) return false; // SPIKE NOTE: if Task 1 found ads report an
    // EMPTY url (not a different id), change this line to `return true`
    // and update the "empty / unparseable url" test to expect true.
    return playingId !== requestedVideoId;
  } catch {
    return false;
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm -C bk-web run test useAdMask`
Expected: PASS (all `detectAd` + `parseVideoId` cases).

- [ ] **Step 5: Commit**

```bash
git add bk-web/hooks/useAdMask.ts bk-web/hooks/useAdMask.test.ts
git commit -m "feat(ad-mask): add getVideoUrl-based ad detection probe"
```

---

## Task 3: `useAdMask` gate hook

**Files:**
- Modify: `bk-web/hooks/useAdMask.ts` (append the hook)
- Test: `bk-web/hooks/useAdMask.test.ts` (append hook tests)

**Interfaces:**
- Consumes: `detectAd`, `AdMaskPlayer` (Task 2).
- Produces:
  `useAdMask(player: AdMaskPlayer | null, requestedVideoId: string, isPlaying: boolean): { isAdGated: boolean }`

- [ ] **Step 1: Write the failing tests**

First, REPLACE the import block at the top of `bk-web/hooks/useAdMask.test.ts`
(added in Task 2) with this consolidated block — import declarations must stay at
the top of the module (the repo's `import/first` ESLint rule rejects mid-file
imports):

```ts
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { detectAd, parseVideoId, useAdMask, type AdMaskPlayer } from './useAdMask';
```

Then append the hook test suite to the bottom of the file (the
`SONG`/`AD_URL`/`SONG_URL` constants below are local to this `describe` to keep
it self-contained):

```ts
describe('useAdMask', () => {
  const SONG = 'songId123';
  const AD_URL = 'https://www.youtube.com/watch?v=adXYZ';
  const SONG_URL = `https://www.youtube.com/watch?v=${SONG}`;

  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  function makePlayer(initialUrl: string) {
    const ref = { url: initialUrl };
    return {
      player: { getPlayerState: () => 1, getVideoUrl: () => ref.url } as AdMaskPlayer,
      setUrl: (u: string) => { ref.url = u; },
    };
  }

  it('arms only after the ad signal holds across the debounce window', () => {
    const { player } = makePlayer(AD_URL);
    const { result } = renderHook(() => useAdMask(player, SONG, true));
    expect(result.current.isAdGated).toBe(false);
    act(() => vi.advanceTimersByTime(250)); // 1st ad poll
    expect(result.current.isAdGated).toBe(false);
    act(() => vi.advanceTimersByTime(250)); // 2nd ad poll → arm
    expect(result.current.isAdGated).toBe(true);
  });

  it('disarms after the song signal holds across the debounce window', () => {
    const { player, setUrl } = makePlayer(AD_URL);
    const { result } = renderHook(() => useAdMask(player, SONG, true));
    act(() => vi.advanceTimersByTime(500)); // arm
    expect(result.current.isAdGated).toBe(true);
    act(() => setUrl(SONG_URL));
    act(() => vi.advanceTimersByTime(250));
    expect(result.current.isAdGated).toBe(true);
    act(() => vi.advanceTimersByTime(250)); // 2nd song poll → disarm
    expect(result.current.isAdGated).toBe(false);
  });

  it('stays disarmed when player is null', () => {
    const { result } = renderHook(() => useAdMask(null, SONG, true));
    act(() => vi.advanceTimersByTime(1000));
    expect(result.current.isAdGated).toBe(false);
  });

  it('stays disarmed when requestedVideoId is empty', () => {
    const { player } = makePlayer(AD_URL);
    const { result } = renderHook(() => useAdMask(player, '', true));
    act(() => vi.advanceTimersByTime(1000));
    expect(result.current.isAdGated).toBe(false);
  });

  it('stays disarmed when isPlaying is false', () => {
    const { player } = makePlayer(AD_URL);
    const { result } = renderHook(() => useAdMask(player, SONG, false));
    act(() => vi.advanceTimersByTime(1000));
    expect(result.current.isAdGated).toBe(false);
  });

  it('force-clears a stuck gate after the safety cap', () => {
    const { player } = makePlayer(AD_URL); // stays on the ad url forever
    const { result } = renderHook(() => useAdMask(player, SONG, true));
    act(() => vi.advanceTimersByTime(500)); // arm
    expect(result.current.isAdGated).toBe(true);
    act(() => vi.advanceTimersByTime(45_000)); // safety cap fires
    expect(result.current.isAdGated).toBe(false);
  });

  it('clears its interval on unmount', () => {
    const clear = vi.spyOn(window, 'clearInterval');
    const { player } = makePlayer(AD_URL);
    const { unmount } = renderHook(() => useAdMask(player, SONG, true));
    unmount();
    expect(clear).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm -C bk-web run test useAdMask`
Expected: FAIL — `useAdMask` is not exported.

- [ ] **Step 3: Implement the hook**

Append to `bk-web/hooks/useAdMask.ts` (add the React import at the top of the
file):

```ts
import { useEffect, useRef, useState } from 'react';

const POLL_MS = 250;
const DEBOUNCE_POLLS = 2; // signal must hold ~500ms before the gate flips
const SAFETY_CAP_MS = 45_000; // never stay gated longer than this

// Polls detectAd and exposes a debounced, self-clearing ad gate. Mirrors the
// EndScreenOverlay 250ms poll cadence. Returns isAdGated=false whenever there
// is nothing to measure (no player / no song id / not playing) so the overlay
// can never appear spuriously.
export function useAdMask(
  player: AdMaskPlayer | null,
  requestedVideoId: string,
  isPlaying: boolean,
): { isAdGated: boolean } {
  const [isAdGated, setIsAdGated] = useState(false);
  const gatedRef = useRef(false);
  const streakRef = useRef(0); // consecutive polls disagreeing with the gate

  useEffect(() => {
    gatedRef.current = isAdGated;
  }, [isAdGated]);

  useEffect(() => {
    if (!player || !requestedVideoId || !isPlaying) {
      setIsAdGated(false);
      streakRef.current = 0;
      return;
    }
    const id = window.setInterval(() => {
      const adNow = detectAd(player, requestedVideoId);
      if (adNow === gatedRef.current) {
        streakRef.current = 0; // agrees with current gate; nothing to flip
        return;
      }
      streakRef.current += 1;
      if (streakRef.current >= DEBOUNCE_POLLS) {
        streakRef.current = 0;
        setIsAdGated(adNow);
      }
    }, POLL_MS);
    return () => window.clearInterval(id);
  }, [player, requestedVideoId, isPlaying]);

  // Safety cap: a stuck reading can never freeze the room behind the overlay.
  useEffect(() => {
    if (!isAdGated) return;
    const id = window.setTimeout(() => setIsAdGated(false), SAFETY_CAP_MS);
    return () => window.clearTimeout(id);
  }, [isAdGated]);

  return { isAdGated };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm -C bk-web run test useAdMask`
Expected: PASS (probe + hook).

- [ ] **Step 5: Commit**

```bash
git add bk-web/hooks/useAdMask.ts bk-web/hooks/useAdMask.test.ts
git commit -m "feat(ad-mask): add debounced useAdMask gate hook with safety cap"
```

---

## Task 4: `AdIntermissionOverlay` component + locale strings

**Files:**
- Create: `bk-web/components/AdIntermissionOverlay.tsx`
- Modify: `bk-shared/src/locales/en.json`, `bk-shared/src/locales/vi.json`
- Test: `bk-web/components/AdIntermissionOverlay.test.tsx`

**Interfaces:**
- Consumes: i18n keys `adMask.title`, `adMask.subtitle`, `adMask.nextUp`.
- Produces:
  `AdIntermissionOverlay({ variant: 'tv' | 'phone'; nextSongTitle?: string | null })`

- [ ] **Step 1: Add locale strings**

In `bk-shared/src/locales/en.json`, add a sibling block next to `"aiMc"`:

```json
  "adMask": {
    "title": "Quick break",
    "subtitle": "The song starts in a moment…",
    "nextUp": "Up next"
  },
```

In `bk-shared/src/locales/vi.json`, add the same key next to `"aiMc"`:

```json
  "adMask": {
    "title": "Nghỉ chút xíu",
    "subtitle": "Bài hát sẽ bắt đầu ngay…",
    "nextUp": "Tiếp theo"
  },
```

- [ ] **Step 2: Write the failing test**

Create `bk-web/components/AdIntermissionOverlay.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AdIntermissionOverlay } from './AdIntermissionOverlay';

// i18n t() is mocked to echo the key so assertions don't depend on copy.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

describe('AdIntermissionOverlay', () => {
  it('renders the intermission title', () => {
    render(<AdIntermissionOverlay variant="tv" />);
    expect(screen.getByText('adMask.title')).toBeInTheDocument();
  });

  it('shows the next song title when provided', () => {
    render(<AdIntermissionOverlay variant="tv" nextSongTitle="Hotel California" />);
    expect(screen.getByText('Hotel California')).toBeInTheDocument();
  });

  it('omits the next-up row when no next song is given', () => {
    render(<AdIntermissionOverlay variant="phone" nextSongTitle={null} />);
    expect(screen.queryByText('adMask.nextUp')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `pnpm -C bk-web run test AdIntermissionOverlay`
Expected: FAIL — component module not found.

- [ ] **Step 4: Implement the component**

Create `bk-web/components/AdIntermissionOverlay.tsx`:

```tsx
'use client';

import { Coffee } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface AdIntermissionOverlayProps {
  // Sizing preset, mirroring MCAnnouncementOverlay. TV stacks at z-10 with
  // larger type; phone stacks at z-[8] below its tap layer.
  variant: 'tv' | 'phone';
  nextSongTitle?: string | null;
}

const VARIANTS = {
  tv: {
    container:
      'absolute inset-0 z-10 flex flex-col items-center justify-center gap-5 px-8 text-center bg-black',
    iconSize: 28,
    title: 'text-3xl font-bold text-white',
    subtitle: 'text-sm text-gray-300 max-w-2xl',
    nextUp: 'text-base text-pink-200',
  },
  phone: {
    container:
      'absolute inset-0 z-[8] flex flex-col items-center justify-center gap-4 px-6 text-center bg-black',
    iconSize: 22,
    title: 'text-xl sm:text-2xl font-bold text-white',
    subtitle: 'text-xs sm:text-sm text-gray-300 max-w-xl',
    nextUp: 'text-sm text-pink-200',
  },
} as const;

export function AdIntermissionOverlay({ variant, nextSongTitle }: AdIntermissionOverlayProps) {
  const { t } = useTranslation();
  const v = VARIANTS[variant];
  return (
    <div className={v.container}>
      <Coffee size={v.iconSize} className="text-pink-300 animate-pulse" />
      <p className={v.title}>{t('adMask.title')}</p>
      <p className={v.subtitle}>{t('adMask.subtitle')}</p>
      {nextSongTitle && (
        <p className={v.nextUp}>
          {t('adMask.nextUp')}{' '}
          <span className="text-white font-semibold">{nextSongTitle}</span>
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm -C bk-web run test AdIntermissionOverlay`
Expected: PASS (all three cases).

- [ ] **Step 6: Commit**

```bash
git add bk-web/components/AdIntermissionOverlay.tsx bk-web/components/AdIntermissionOverlay.test.tsx bk-shared/src/locales/en.json bk-shared/src/locales/vi.json
git commit -m "feat(ad-mask): add AdIntermissionOverlay + adMask locale strings"
```

---

## Task 5: Wire ad masking into the TV view

**Files:**
- Modify: `bk-web/features/tv/TVClient.tsx`

**Interfaces:**
- Consumes: `useAdMask` (Task 3), `AdIntermissionOverlay` (Task 4),
  `isMcGated` / `ytPlayer` / `roomData` (existing).
- Produces: nothing (integration).

- [ ] **Step 1: Add imports**

Near the other hook/component imports in `bk-web/features/tv/TVClient.tsx`:

```tsx
import { useAdMask } from '@/hooks/useAdMask';
import { AdIntermissionOverlay } from '@/components/AdIntermissionOverlay';
```

- [ ] **Step 2: Call the hook**

After `useMCPlayer` is consumed (where `isMcGated` and `ytPlayer` exist), add:

```tsx
// Ad masking: cover + mute the embed while an ad plays. Disarmed during the
// MC gate (MC takes precedence) and whenever playback is paused.
const { isAdGated } = useAdMask(
  ytPlayer,
  roomData.currentPlaying?.id ?? '',
  !isMcGated && roomData.isPlaying,
);
```

- [ ] **Step 3: Fold the ad gate into the player's mute + sync**

In the `<VideoPlayer>` JSX (currently `bk-web/features/tv/TVClient.tsx:207-219`),
change the `volume` and `onPlayingChange` props so the ad gate also mutes and
suppresses echo (do NOT change `isPlaying` — the ad must play out behind the
overlay):

```tsx
                volume={isMcGated || isAdGated ? 0 : roomData.volume}
                onPlayingChange={isMcGated || isAdGated ? undefined : setIsPlaying}
```

- [ ] **Step 4: Render the overlay**

Immediately after the existing `{isMcGated && ( <MCAnnouncementOverlay … /> )}`
block (around `bk-web/features/tv/TVClient.tsx:220-227`), add — note the
`!isMcGated` guard enforces MC precedence:

```tsx
              {isAdGated && !isMcGated && (
                <AdIntermissionOverlay
                  variant="tv"
                  nextSongTitle={roomData.queue[0]?.title ?? null}
                />
              )}
```

- [ ] **Step 5: Verify typecheck + lint + tests + build**

Run: `pnpm -C bk-web run typecheck`
Expected: PASS

Run: `pnpm -C bk-web run lint`
Expected: PASS

Run: `pnpm -C bk-web run test`
Expected: PASS (no regressions)

- [ ] **Step 6: Commit**

```bash
git add bk-web/features/tv/TVClient.tsx
git commit -m "feat(ad-mask): mask ads with intermission overlay on the TV view"
```

---

## Task 6: Wire ad masking into the phone fullscreen player

**Files:**
- Modify: `bk-web/features/remote/components/FullscreenPlayer.tsx`

**Interfaces:**
- Consumes: `useAdMask` (Task 3), `AdIntermissionOverlay` (Task 4),
  `isMcGated` / `ytPlayer` / `track` / `isPlaying` (existing).
- Produces: nothing (integration).

- [ ] **Step 1: Add imports**

Near the other imports in `bk-web/features/remote/components/FullscreenPlayer.tsx`:

```tsx
import { useAdMask } from '@/hooks/useAdMask';
import { AdIntermissionOverlay } from '@/components/AdIntermissionOverlay';
```

- [ ] **Step 2: Call the hook**

Where `isMcGated` and `ytPlayer` are available in the component body, add:

```tsx
const { isAdGated } = useAdMask(
  ytPlayer,
  track?.id ?? '',
  !isMcGated && isPlaying,
);
```

- [ ] **Step 3: Fold the ad gate into the player's mute + sync**

In the `<VideoPlayer>` JSX (currently
`bk-web/features/remote/components/FullscreenPlayer.tsx:314-322`), change:

```tsx
              volume={isMcGated || isAdGated ? 0 : volume}
              onPlayingChange={isMcGated || isAdGated ? undefined : onPlayingChange}
```

- [ ] **Step 4: Render the overlay**

Immediately after the existing `{isMcGated && ( <MCAnnouncementOverlay … /> )}`
block (around `bk-web/features/remote/components/FullscreenPlayer.tsx:323-331`),
add:

```tsx
            {isAdGated && !isMcGated && (
              <AdIntermissionOverlay variant="phone" nextSongTitle={nextSongTitle ?? null} />
            )}
```

- [ ] **Step 5: Verify typecheck + lint + tests**

Run: `pnpm -C bk-web run typecheck`
Expected: PASS

Run: `pnpm -C bk-web run lint`
Expected: PASS

Run: `pnpm -C bk-web run test`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add bk-web/features/remote/components/FullscreenPlayer.tsx
git commit -m "feat(ad-mask): mask ads with intermission overlay in fullscreen player"
```

---

## Task 7: Final verification gates

**Files:** none (verification only).

**Interfaces:** none.

- [ ] **Step 1: Full fast checks**

Run: `pnpm -C bk-web run typecheck`
Expected: PASS

Run: `pnpm -C bk-web run lint`
Expected: PASS

Run: `pnpm -C bk-web run test`
Expected: PASS — confirm no `.skip`/`.only`/`.todo` were introduced.

- [ ] **Step 2: Production build**

Run: `pnpm build`
Expected: PASS

- [ ] **Step 3: Existing Playwright suite (regression gate)**

Run: `pnpm -C bk-web run test:e2e`
Expected: PASS — existing `/tv` and `/remote` flows unaffected.

> **E2E coverage note (CLAUDE.md Rule 1 justification):** No new Playwright
> test is added for the masking trigger. The Playwright suite runs against a
> production build with **no Firebase backend** (`playwright.config.ts:26`), so
> `currentPlaying` is never set and the video section — where `useAdMask` runs —
> never mounts. Real ads are also non-deterministic and the YouTube iframe is
> cross-origin (un-stubbable in-browser). The detection logic, debounce, safety
> cap, and overlay rendering are therefore fully covered by Vitest +
> Testing Library (Tasks 2–4); the Playwright run here is a regression gate
> only.

- [ ] **Step 4: Report**

Output the required CLAUDE.md report (Files changed source/tests + "Why each test
exists") and the verification summary:

```text
✅ typecheck
✅ lint
✅ vitest (N tests)
✅ build
✅ playwright (N tests, regression)
```
