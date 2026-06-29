# YouTube Ad Masking — Mobile (bk-mobile) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Port the web ad-masking feature to the bk-mobile app: detect when an ad plays in the YouTube embed and mute it — covering the fullscreen player with an intermission overlay, and muting (no overlay) the hidden background audio driver — auto-restoring when the song resumes.

**Architecture:** A shared `parseVideoId` moves to `bk-shared`. An async mobile hook `useAdMask` polls `react-native-youtube-iframe`'s Promise-based `getVideoUrl()` ref method (the library exposes no `getPlayerState()` ref, so playing state is tracked from the `onChangeState` callback). The fullscreen player and a new extracted `BackgroundAudioDriver` each own a player ref + the hook and pass `mute={…isAdGated}`. The fullscreen player also renders a new RN `AdIntermissionOverlay`.

**Tech Stack:** Expo / React Native, `react-native-youtube-iframe` v2.4.1, jest-expo + @testing-library/react-native, react-i18next, `@bs-kara/shared`.

## Global Constraints

- Commit messages: Conventional Commits subject + optional body only. **NO Claude/Anthropic attribution** (no `Co-Authored-By`, no "Generated with").
- ToS-compliant: keep the official player; do NOT skip/remove ads. Mute + cover only.
- Detection signal: `getVideoUrl()` id-mismatch vs the requested videoId (same as web; still gated on the unrun web Phase-0 spike — if ads report an EMPTY url instead of a different id, flip the `if (!id) return false` branch + its test).
- `mute` prop drives muting (the library supports `mute?: boolean`). The ad gate must NOT change the `play` prop — the ad must play out behind the mute/overlay (unlike the MC gate, which pauses).
- MC gate takes precedence over the ad gate (fullscreen): overlay guarded by `!isMcGated`; `mute = isMcGated || isAdGated`.
- Test quality: no `.skip`/`.only`/`.todo`; real assertions; prefer `getByText`/`getByRole`/`getByTestId` per existing RN test style.
- Reuse the existing `adMask.*` i18n keys already in `bk-shared/src/locales/{en,vi}.json` (title/subtitle/nextUp).
- Commands: `pnpm -C bk-mobile run typecheck`, `pnpm -C bk-mobile run lint`, `pnpm -C bk-mobile run test`; shared: `pnpm -C bk-shared run test`; web regression: `pnpm -C bk-web run test useAdMask`.

---

## Task 1: Extract `parseVideoId` to bk-shared

**Files:**
- Create: `bk-shared/src/lib/youtube/adDetection.ts`
- Create: `bk-shared/src/lib/youtube/adDetection.test.ts`
- Modify: `bk-shared/src/index.ts` (export `parseVideoId`)
- Modify: `bk-web/hooks/useAdMask.ts` (import + re-export from shared; drop local copy)

**Interfaces:**
- Produces: `parseVideoId(url: string): string | null` exported from `@bs-kara/shared`.

- [ ] **Step 1: Write the failing shared test**

Create `bk-shared/src/lib/youtube/adDetection.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { parseVideoId } from './adDetection';

describe('parseVideoId', () => {
  it('extracts the v= id from a watch URL', () => {
    expect(parseVideoId('https://www.youtube.com/watch?v=abc123&t=4')).toBe('abc123');
  });
  it('extracts the v= id when not the first query param', () => {
    expect(parseVideoId('https://www.youtube.com/watch?list=x&v=abc123')).toBe('abc123');
  });
  it('returns null for an empty or non-watch URL', () => {
    expect(parseVideoId('')).toBeNull();
    expect(parseVideoId('https://www.youtube.com/')).toBeNull();
  });
});
```

- [ ] **Step 2: Run it red**

Run: `pnpm -C bk-shared run test adDetection`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `bk-shared/src/lib/youtube/adDetection.ts`:

```ts
// Pull the v= id out of a YouTube watch URL. Returns null when the URL is empty
// or has no parseable id. Shared by the web (sync) and mobile (async) ad-mask
// detection so the URL-parsing rule lives in one place.
export function parseVideoId(url: string): string | null {
  if (!url) return null;
  const match = url.match(/[?&]v=([^&]+)/);
  return match ? match[1] : null;
}
```

Add to `bk-shared/src/index.ts` (near the other `./lib/youtube/*` exports):

```ts
export { parseVideoId } from './lib/youtube/adDetection';
```

- [ ] **Step 4: Run it green**

Run: `pnpm -C bk-shared run test adDetection`
Expected: PASS.

- [ ] **Step 5: Point web at the shared copy (keep web tests green)**

In `bk-web/hooks/useAdMask.ts`: remove the local `parseVideoId` function definition and instead import + re-export it from shared, so `bk-web/hooks/useAdMask.test.ts` (which imports `parseVideoId` from `./useAdMask`) keeps passing unchanged. At the top of the file add:

```ts
import { parseVideoId } from '@bs-kara/shared';
```

And add a re-export so existing importers still resolve it from this module:

```ts
export { parseVideoId };
```

`detectAd` already calls `parseVideoId(...)` — it now resolves to the imported one. Leave everything else in the file unchanged.

- [ ] **Step 6: Verify web + shared + typecheck**

Run: `pnpm -C bk-shared run test`
Expected: PASS.

Run: `pnpm -C bk-web run test useAdMask`
Expected: PASS (8 detectAd/parseVideoId + useAdMask tests unchanged).

Run: `pnpm -C bk-web run typecheck`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add bk-shared/src/lib/youtube/adDetection.ts bk-shared/src/lib/youtube/adDetection.test.ts bk-shared/src/index.ts bk-web/hooks/useAdMask.ts
git commit -m "refactor(ad-mask): hoist parseVideoId into bk-shared"
```

---

## Task 2: Mobile async ad-mask hook (`useAdMask`)

**Files:**
- Create: `bk-mobile/hooks/useAdMask.ts`
- Test: `bk-mobile/hooks/useAdMask.test.ts`

**Interfaces:**
- Consumes: `parseVideoId` from `@bs-kara/shared` (Task 1).
- Produces:
  - `interface AdMaskNativeRef { getVideoUrl: () => Promise<string>; }`
  - `detectAdNative(ref: AdMaskNativeRef | null, requestedVideoId: string, isPlaying: boolean): Promise<boolean>`
  - `useAdMask(playerRef: React.RefObject<AdMaskNativeRef | null>, requestedVideoId: string, isPlaying: boolean): { isAdGated: boolean }`

- [ ] **Step 1: Write the failing tests**

Create `bk-mobile/hooks/useAdMask.test.ts`:

```ts
import { act, renderHook } from '@testing-library/react-native';
import { detectAdNative, useAdMask, type AdMaskNativeRef } from './useAdMask';

const SONG = 'songId123';
const AD_URL = 'https://www.youtube.com/watch?v=adXYZ';
const SONG_URL = `https://www.youtube.com/watch?v=${SONG}`;

function refTo(url: string): { current: AdMaskNativeRef } {
  return { current: { getVideoUrl: () => Promise.resolve(url) } };
}

describe('detectAdNative', () => {
  it('reports an ad when playing and the url id differs', async () => {
    await expect(detectAdNative(refTo(AD_URL).current, SONG, true)).resolves.toBe(true);
  });
  it('reports no ad when the url id matches', async () => {
    await expect(detectAdNative(refTo(SONG_URL).current, SONG, true)).resolves.toBe(false);
  });
  it('reports no ad when not playing', async () => {
    await expect(detectAdNative(refTo(AD_URL).current, SONG, false)).resolves.toBe(false);
  });
  it('reports no ad when ref is null', async () => {
    await expect(detectAdNative(null, SONG, true)).resolves.toBe(false);
  });
  it('reports no ad when requestedVideoId is empty', async () => {
    await expect(detectAdNative(refTo(AD_URL).current, '', true)).resolves.toBe(false);
  });
  it('swallows a rejected getVideoUrl and reports no ad', async () => {
    const ref = { getVideoUrl: () => Promise.reject(new Error('teardown')) };
    await expect(detectAdNative(ref, SONG, true)).resolves.toBe(false);
  });
});

describe('useAdMask', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('arms after the ad signal holds across the debounce window', async () => {
    const ref = refTo(AD_URL);
    const { result } = renderHook(() => useAdMask(ref, SONG, true));
    await act(async () => { jest.advanceTimersByTime(250); });
    expect(result.current.isAdGated).toBe(false);
    await act(async () => { jest.advanceTimersByTime(250); });
    expect(result.current.isAdGated).toBe(true);
  });

  it('stays disarmed when not playing', async () => {
    const ref = refTo(AD_URL);
    const { result } = renderHook(() => useAdMask(ref, SONG, false));
    await act(async () => { jest.advanceTimersByTime(1000); });
    expect(result.current.isAdGated).toBe(false);
  });

  it('stays disarmed when requestedVideoId is empty', async () => {
    const ref = refTo(AD_URL);
    const { result } = renderHook(() => useAdMask(ref, '', true));
    await act(async () => { jest.advanceTimersByTime(1000); });
    expect(result.current.isAdGated).toBe(false);
  });

  it('force-clears a stuck gate after the safety cap', async () => {
    const ref = refTo(AD_URL);
    const { result } = renderHook(() => useAdMask(ref, SONG, true));
    await act(async () => { jest.advanceTimersByTime(500); });
    expect(result.current.isAdGated).toBe(true);
    await act(async () => { jest.advanceTimersByTime(45_000); });
    expect(result.current.isAdGated).toBe(false);
  });
});
```

- [ ] **Step 2: Run it red**

Run: `pnpm -C bk-mobile run test useAdMask`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `bk-mobile/hooks/useAdMask.ts`:

```ts
import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { parseVideoId } from '@bs-kara/shared';

// The slice of react-native-youtube-iframe's ref we depend on. Its methods are
// async (Promise-based), unlike the web YouTube player.
export interface AdMaskNativeRef {
  getVideoUrl: () => Promise<string>;
}

const POLL_MS = 250;
const DEBOUNCE_POLLS = 2; // signal must hold ~500ms before the gate flips
const SAFETY_CAP_MS = 45_000;

// Async ad probe. Fail-safe: not playing, no requested id, no ref, unparseable
// url, or any rejection → false (never a false ad).
export async function detectAdNative(
  ref: AdMaskNativeRef | null,
  requestedVideoId: string,
  isPlaying: boolean,
): Promise<boolean> {
  if (!ref || !requestedVideoId || !isPlaying) return false;
  try {
    const url = await ref.getVideoUrl();
    const id = parseVideoId(url);
    if (!id) return false; // SPIKE NOTE: flip to `return true` if ads report an
    // empty url rather than a different id (see web Phase-0 spike).
    return id !== requestedVideoId;
  } catch {
    return false;
  }
}

// Polls detectAdNative on an interval and exposes a debounced, self-clearing ad
// gate. Disarms whenever there is nothing to measure (no song id / not playing).
export function useAdMask(
  playerRef: RefObject<AdMaskNativeRef | null>,
  requestedVideoId: string,
  isPlaying: boolean,
): { isAdGated: boolean } {
  const [isAdGated, setIsAdGated] = useState(false);
  const gatedRef = useRef(false);
  const streakRef = useRef(0);

  useEffect(() => {
    gatedRef.current = isAdGated;
  }, [isAdGated]);

  useEffect(() => {
    if (!requestedVideoId || !isPlaying) {
      setIsAdGated(false);
      streakRef.current = 0;
      return;
    }
    let cancelled = false;
    const id = setInterval(() => {
      void (async () => {
        const adNow = await detectAdNative(playerRef.current, requestedVideoId, isPlaying);
        if (cancelled) return;
        if (adNow === gatedRef.current) {
          streakRef.current = 0;
          return;
        }
        streakRef.current += 1;
        if (streakRef.current >= DEBOUNCE_POLLS) {
          streakRef.current = 0;
          setIsAdGated(adNow);
        }
      })();
    }, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [playerRef, requestedVideoId, isPlaying]);

  // Safety cap: a stuck reading can never freeze the room behind a muted/covered
  // player. NOTE: if a real ad signal outlasts the cap, force-clearing briefly
  // unmutes (~one poll) until the gate re-arms — accepted tradeoff.
  useEffect(() => {
    if (!isAdGated) return;
    const id = setTimeout(() => setIsAdGated(false), SAFETY_CAP_MS);
    return () => clearTimeout(id);
  }, [isAdGated]);

  return { isAdGated };
}
```

If `pnpm -C bk-mobile run lint` flags `set-state-in-effect` on the guard-clause `setIsAdGated(false)`, mirror the web fix: wrap it as `setTimeout(() => setIsAdGated(false), 0)` with a `clearTimeout` cleanup. Only apply this if lint actually flags it.

- [ ] **Step 4: Run it green**

Run: `pnpm -C bk-mobile run test useAdMask`
Expected: PASS. If a `useAdMask` timer test is flaky on promise flushing, ensure each timer advance is inside `await act(async () => …)` (already so above).

- [ ] **Step 5: typecheck + lint**

Run: `pnpm -C bk-mobile run typecheck` → PASS
Run: `pnpm -C bk-mobile run lint` → PASS

- [ ] **Step 6: Commit**

```bash
git add bk-mobile/hooks/useAdMask.ts bk-mobile/hooks/useAdMask.test.ts
git commit -m "feat(ad-mask): add async useAdMask hook for mobile"
```

---

## Task 3: `AdIntermissionOverlay` (React Native)

**Files:**
- Create: `bk-mobile/components/AdIntermissionOverlay.tsx`
- Test: `bk-mobile/components/AdIntermissionOverlay.test.tsx`

**Interfaces:**
- Consumes: i18n keys `adMask.title`, `adMask.subtitle`, `adMask.nextUp`.
- Produces: `AdIntermissionOverlay({ nextSongTitle?: string | null })`

- [ ] **Step 1: Write the failing test**

Create `bk-mobile/components/AdIntermissionOverlay.test.tsx`:

```tsx
import { render } from '@testing-library/react-native';
import { AdIntermissionOverlay } from './AdIntermissionOverlay';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

describe('AdIntermissionOverlay', () => {
  it('renders the intermission title', () => {
    const { getByText } = render(<AdIntermissionOverlay />);
    expect(getByText('adMask.title')).toBeTruthy();
  });
  it('shows the next song title when provided', () => {
    const { getByText } = render(<AdIntermissionOverlay nextSongTitle="Hotel California" />);
    expect(getByText('Hotel California')).toBeTruthy();
  });
  it('omits the next-up row when no next song is given', () => {
    const { queryByText } = render(<AdIntermissionOverlay nextSongTitle={null} />);
    expect(queryByText('adMask.nextUp')).toBeNull();
  });
});
```

- [ ] **Step 2: Run it red**

Run: `pnpm -C bk-mobile run test AdIntermissionOverlay`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `bk-mobile/components/AdIntermissionOverlay.tsx`, mirroring the opaque
absolute-fill / `zIndex: 8` pattern of `MCAnnouncementOverlay.tsx`:

```tsx
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Coffee } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useColors } from '@/hooks/useColors';

interface AdIntermissionOverlayProps {
  nextSongTitle?: string | null;
}

// Opaque cover shown over the fullscreen player while an ad plays, so the room
// never sees the ad. Audio is silenced separately via the player's mute prop.
export function AdIntermissionOverlay({ nextSongTitle }: AdIntermissionOverlayProps): React.ReactElement {
  const { t } = useTranslation();
  const c = useColors();
  return (
    <View style={styles.container}>
      <Coffee size={28} color="#f9a8d4" />
      <Text style={styles.title}>{t('adMask.title')}</Text>
      <Text style={[styles.subtitle, { color: c.muted }]}>{t('adMask.subtitle')}</Text>
      {nextSongTitle ? (
        <Text style={styles.nextUp}>
          {t('adMask.nextUp')} <Text style={styles.nextUpTitle}>{nextSongTitle}</Text>
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 8,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 14,
  },
  title: { color: '#ffffff', fontSize: 22, fontWeight: '700', textAlign: 'center' },
  subtitle: { fontSize: 14, textAlign: 'center' },
  nextUp: { color: '#f9a8d4', fontSize: 14, textAlign: 'center' },
  nextUpTitle: { color: '#ffffff', fontWeight: '600' },
});
```

- [ ] **Step 4: Run it green**

Run: `pnpm -C bk-mobile run test AdIntermissionOverlay`
Expected: PASS. (If `useColors` needs a provider in tests, mock it like other component tests do — check `MCAnnouncementOverlay`'s test setup, or mock `@/hooks/useColors` to return a plain object.)

- [ ] **Step 5: typecheck + lint, then commit**

Run: `pnpm -C bk-mobile run typecheck` → PASS; `pnpm -C bk-mobile run lint` → PASS

```bash
git add bk-mobile/components/AdIntermissionOverlay.tsx bk-mobile/components/AdIntermissionOverlay.test.tsx
git commit -m "feat(ad-mask): add AdIntermissionOverlay for mobile"
```

---

## Task 4: Wire ad masking into the mobile FullscreenPlayer

**Files:**
- Modify: `bk-mobile/components/FullscreenPlayer.tsx`

**Interfaces:**
- Consumes: `useAdMask` (Task 2), `AdIntermissionOverlay` (Task 3).
- Produces: nothing (integration).

- [ ] **Step 1: Add imports + a ref + a player-state tracker**

In `bk-mobile/components/FullscreenPlayer.tsx`:
- Import the ref type, hook, and overlay, plus the player-state enum:

```tsx
import YoutubeIframe, { PLAYER_STATES, type YoutubeIframeRef } from 'react-native-youtube-iframe';
import { useAdMask } from '@/hooks/useAdMask';
import { AdIntermissionOverlay } from '@/components/AdIntermissionOverlay';
```

(`YoutubeIframe` is already a default import — fold the named imports into the same statement.)

- Inside the component, add a ref and a playing-state flag (the library exposes
  no `getPlayerState()` ref method, so track it from `onChangeState`):

```tsx
  const playerRef = useRef<YoutubeIframeRef>(null);
  const [playerPlaying, setPlayerPlaying] = useState(false);
```

- [ ] **Step 2: Call the ad-mask hook**

After `useMCPlayer` is consumed (so `isMcGated` is in scope), add:

```tsx
  // Ad masking: mute + cover the embed while an ad plays. Disarmed during the
  // MC gate (MC precedence) and whenever the player is not actively playing.
  const { isAdGated } = useAdMask(playerRef, videoId, !isMcGated && playerPlaying);
```

- [ ] **Step 3: Attach the ref, mute, and track state on the iframe**

Change the `<YoutubeIframe>` element (currently lines ~104-113): add `ref`, add
the `mute` prop, and have `onChangeState` update `playerPlaying`. Do NOT change
the `play` prop (the ad must play out behind the mute + overlay):

```tsx
        <YoutubeIframe
          ref={playerRef}
          videoId={videoId}
          height={playerHeight}
          width={playerWidth}
          play={!isMcGated && shouldPlay}
          mute={isMcGated || isAdGated}
          webViewStyle={{ backgroundColor: '#000' }}
          forceAndroidAutoplay
          onReady={() => {}}
          onChangeState={(state: string) => setPlayerPlaying(state === PLAYER_STATES.PLAYING)}
        />
```

(The previous `console.log` `onReady`/`onChangeState` debug handlers are removed in favor of the real state tracker.)

- [ ] **Step 4: Render the intermission overlay (MC precedence)**

Immediately after the existing `{isMcGated && currentPlaying && ( <MCAnnouncementOverlay … /> )}` block, add:

```tsx
        {isAdGated && !isMcGated && (
          <AdIntermissionOverlay nextSongTitle={roomData.queue[0]?.title ?? null} />
        )}
```

(`roomData` is already destructured from `useRoomContext()` at the top of the component; if only `currentPlaying`/`isMCEnabled`/`mcVoice` were pulled out, also pull `queue` — or reference `roomData.queue`.)

- [ ] **Step 5: Verify**

Run: `pnpm -C bk-mobile run typecheck` → PASS
Run: `pnpm -C bk-mobile run lint` → PASS
Run: `pnpm -C bk-mobile run test` → PASS (no regressions; the existing `player.test.tsx` mocks the iframe as a string and `useMCPlayer`, so it is unaffected)

- [ ] **Step 6: Commit**

```bash
git add bk-mobile/components/FullscreenPlayer.tsx
git commit -m "feat(ad-mask): mask ads in the mobile fullscreen player"
```

---

## Task 5: Mute ads on the background audio driver

**Files:**
- Create: `bk-mobile/components/BackgroundAudioDriver.tsx`
- Test: `bk-mobile/components/BackgroundAudioDriver.test.tsx`
- Modify: `bk-mobile/app/(room)/player.tsx`

**Interfaces:**
- Consumes: `useAdMask` (Task 2).
- Produces: `BackgroundAudioDriver({ videoId: string; isPlaying: boolean })`

**Why a new component:** the background driver needs its own player ref, an
`onChangeState` tracker, and the ad-mask hook. Encapsulating it keeps `player.tsx`
(a screen) free of player-detail hooks and gives the behavior an isolated test.

- [ ] **Step 1: Write the failing test**

Create `bk-mobile/components/BackgroundAudioDriver.test.tsx`. Mock the hook and
the iframe so the test asserts wiring (mute follows `isAdGated`), following the
`player.test.tsx` mock style:

```tsx
import { render } from '@testing-library/react-native';

const mockUseAdMask = jest.fn();
jest.mock('@/hooks/useAdMask', () => ({ useAdMask: () => mockUseAdMask() }));

// Capture the props passed to the iframe so we can assert on `mute`/`play`.
const iframeProps: Record<string, unknown>[] = [];
jest.mock('react-native-youtube-iframe', () => {
  const React = require('react');
  return {
    __esModule: true,
    default: (props: Record<string, unknown>) => {
      iframeProps.push(props);
      return React.createElement('YoutubeIframe', props);
    },
    PLAYER_STATES: { PLAYING: 'playing' },
  };
});

import { BackgroundAudioDriver } from './BackgroundAudioDriver';

beforeEach(() => { iframeProps.length = 0; });

it('mutes the driver when an ad is gated', () => {
  mockUseAdMask.mockReturnValue({ isAdGated: true });
  render(<BackgroundAudioDriver videoId="song1" isPlaying={true} />);
  expect(iframeProps[0].mute).toBe(true);
  expect(iframeProps[0].play).toBe(true); // play is NOT ad-gated
});

it('does not mute when no ad is gated', () => {
  mockUseAdMask.mockReturnValue({ isAdGated: false });
  render(<BackgroundAudioDriver videoId="song1" isPlaying={true} />);
  expect(iframeProps[0].mute).toBe(false);
});
```

- [ ] **Step 2: Run it red**

Run: `pnpm -C bk-mobile run test BackgroundAudioDriver`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `bk-mobile/components/BackgroundAudioDriver.tsx`:

```tsx
import React, { useRef, useState } from 'react';
import YoutubeIframe, { PLAYER_STATES, type YoutubeIframeRef } from 'react-native-youtube-iframe';
import { useAdMask } from '@/hooks/useAdMask';

interface BackgroundAudioDriverProps {
  videoId: string;
  isPlaying: boolean;
}

// The hidden (0x0) audio driver that plays the song while the user is on the
// now-playing card (not fullscreen). There is no overlay here — the card already
// hides the video — but ad audio must still be muted.
export function BackgroundAudioDriver({ videoId, isPlaying }: BackgroundAudioDriverProps): React.ReactElement {
  const playerRef = useRef<YoutubeIframeRef>(null);
  const [playerPlaying, setPlayerPlaying] = useState(false);
  const { isAdGated } = useAdMask(playerRef, videoId, isPlaying && playerPlaying);

  return (
    <YoutubeIframe
      ref={playerRef}
      videoId={videoId}
      height={0}
      width={0}
      play={isPlaying}
      mute={isAdGated}
      onChangeState={(state: string) => setPlayerPlaying(state === PLAYER_STATES.PLAYING)}
    />
  );
}
```

- [ ] **Step 4: Run it green**

Run: `pnpm -C bk-mobile run test BackgroundAudioDriver`
Expected: PASS.

- [ ] **Step 5: Use it in the player screen**

In `bk-mobile/app/(room)/player.tsx`: replace the inline background iframe
(currently lines 38-40) with the component, preserving the existing guard:

```tsx
import { BackgroundAudioDriver } from '@/components/BackgroundAudioDriver';
```

```tsx
      {/* Background audio driver — suppressed while fullscreen is open (FullscreenPlayer has its own iframe + MC gate). */}
      {!isTvActive && !fullscreenOpen && (
        <BackgroundAudioDriver videoId={currentPlaying.id} isPlaying={isPlaying} />
      )}
```

Remove the now-unused `import YoutubeIframe from 'react-native-youtube-iframe';` from `player.tsx` if nothing else in the file uses it.

- [ ] **Step 6: Verify**

Run: `pnpm -C bk-mobile run typecheck` → PASS
Run: `pnpm -C bk-mobile run lint` → PASS
Run: `pnpm -C bk-mobile run test` → PASS (the existing `player.test.tsx` mocks `react-native-youtube-iframe` as the string `'YoutubeIframe'`; importing `BackgroundAudioDriver` there will exercise that mock — if `player.test.tsx` breaks because the driver imports the iframe's named `PLAYER_STATES`, extend that test's mock to provide `{ __esModule: true, default: 'YoutubeIframe', PLAYER_STATES: { PLAYING: 'playing' } }`, matching this task's component test).

- [ ] **Step 7: Commit**

```bash
git add "bk-mobile/components/BackgroundAudioDriver.tsx" "bk-mobile/components/BackgroundAudioDriver.test.tsx" "bk-mobile/app/(room)/player.tsx"
git commit -m "feat(ad-mask): mute ads on the mobile background audio driver"
```

---

## Task 6: Final verification (mobile)

**Files:** none (verification only).

- [ ] **Step 1: Mobile gates**

Run: `pnpm -C bk-mobile run typecheck` → PASS
Run: `pnpm -C bk-mobile run lint` → PASS
Run: `pnpm -C bk-mobile run test` → PASS (no `.skip`/`.only`/`.todo`)

- [ ] **Step 2: Cross-workspace regression**

Run: `pnpm -C bk-shared run test` → PASS
Run: `pnpm -C bk-web run test useAdMask` → PASS (parseVideoId hoist did not break web)
Run: `pnpm -C bk-web run typecheck` → PASS

- [ ] **Step 3: Report**

Output the CLAUDE.md report (source files / test files / why each test) and:

```
✅ bk-mobile typecheck / lint / jest (N tests)
✅ bk-shared vitest
✅ bk-web useAdMask + typecheck (regression)
```

> **E2E note (CLAUDE.md Rule 1):** No device/e2e test for the masking trigger — it
> depends on real non-deterministic ads inside a cross-origin WebView with no
> seeded Firebase data in the jest environment. Detection, debounce, safety cap,
> overlay, and wiring are covered by jest + @testing-library/react-native.
> The `getVideoUrl()` signal itself remains gated on the web Phase-0 spike.
