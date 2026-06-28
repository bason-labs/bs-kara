# YouTube Ad Masking — Design

**Date:** 2026-06-28
**Status:** Approved (design); pending implementation plan
**Scope:** `bk-web` (TV view + phone fullscreen player)

## Problem

The karaoke app plays songs through the official YouTube IFrame Player API
(`react-youtube`). YouTube serves pre-roll and mid-roll ads inside that embed.
On a shared TV the room sees and hears the ad, which breaks the karaoke
experience.

## Constraint (decided)

We stay **ToS-compliant**: we keep the official IFrame player. That means we
**cannot remove or skip ads** — the YouTube API exposes no ad-skip, and the ad
plays in a cross-origin iframe we are not allowed to reach into. Truly ad-free
playback would require leaving the official player (raw-stream extraction via
yt-dlp / an Invidious-style proxy), which violates YouTube's Terms of Service
and breaks frequently. That path was explicitly rejected.

## Goal

When an ad is **likely** playing inside the embed, **mask** it on the shared
screen: mute the audio and cover the video with a branded "intermission"
overlay, then auto-restore the moment the real song starts. We never skip the
ad — we wait it out gracefully so the room is not blasted with ad audio/video.

Non-goals: removing ads, clicking "Skip", reducing ad frequency via content
sourcing (a separate possible effort, not in this spec).

## Detection

There is no official "ad" event in the IFrame API, so detection is heuristic.

**Constraints discovered during planning (these shaped the signal choice):**

- The app never stores a real song duration — the search BFF hardcodes
  `duration: ''` (`bk-web/app/api/youtube/search/route.ts:98`), and the YouTube
  *search* endpoint does not return durations. So there is **no known song
  duration** to compare `getDuration()` against. Duration-mismatch is therefore
  **not** the primary signal.
- `getVideoData()` is **not reachable**: playback goes through the
  `youtube-player` wrapper under `react-youtube`, whose exposed method list does
  not include `getVideoData()`. Reachable, useful methods are `getVideoUrl()`,
  `getDuration()`, `getCurrentTime()`, `getPlayerState()`.

**Primary signal — video-id mismatch via `getVideoUrl()`.** We always have the
requested `videoId` (it is the `currentPlaying.id` prop). `player.getVideoUrl()`
returns the URL of whatever is currently on screen. Extract the `v=` id from it
and compare to the requested `videoId`:

- State is `PLAYING` (`getPlayerState() === 1`), **and**
- `getVideoUrl()` returns a parseable id, **and**
- that id ≠ the requested `videoId`
  → `isAdLikely = true` → mute + overlay.
- When the id matches the requested `videoId` again →
  `isAdLikely = false` → unmute + uncover.

Polled at the existing 250 ms cadence used by `EndScreenOverlay`.

**Honest limitations:** this is a heuristic, and whether `getVideoUrl()`
actually reflects the ad (vs. always returning the requested video's URL) is
**unverified** — that is what the Phase 0 spike must confirm before the rest is
built. Mitigations (debounce, safety timeout) below.

### Phase 0 — validation spike (do FIRST, decision-gating, throwaway)

This spike is **decision-gating**, not just tuning: if `getVideoUrl()` does not
change during ads, the primary signal is invalid and we reconvene before
building Tasks 2+.

Instrument a real ad-bearing video on the TV and log, over time:

- `player.getVideoUrl()`
- `player.getPlayerState()`
- `player.getDuration()` / `player.getCurrentTime()` (secondary observation)

Confirm `getVideoUrl()` reports a different id (or an unparseable/empty URL)
while an ad plays and snaps back to the requested id when the song starts. Tune
the debounce and safety-timeout constants. The spike is instrumentation only —
not shipped, no tests — but its findings are recorded back into this spec.

## Architecture

Model ad masking on the existing **MC gate** pattern (`useMCPlayer` /
`isMcGated`), which already does "mute + cover + suppress state echo". This
composes with the current code instead of fighting it.

### `detectAd(player, requestedVideoId)` — signal probe (pure-ish)

- Location: `hooks/useAdMask.ts` (co-located, exported for unit tests).
- Reads `player.getPlayerState()` and `player.getVideoUrl()`, extracts the `v=`
  id, returns `true` when state is PLAYING and the parsed id ≠
  `requestedVideoId`. Returns `false` on any unparseable/empty URL or non-PLAYING
  state (fail-safe — never reports an ad when unsure). Wrapped in try/catch (the
  YT widget API throws mid-teardown, mirroring `VideoPlayer`).
- This is the only spike-informed unit; the gate machine below is signal-agnostic.

### `useAdMask(player, requestedVideoId, isPlaying)` — new hook

- Location: `hooks/` (next to `useMCPlayer`).
- Returns `{ isAdGated }`.
- Owns: the 250 ms poll (calls `detectAd`), edge debounce, and the safety
  timeout. Clears its interval on unmount / song change.
- Disarmed (returns `isAdGated: false` always) when `player` is null or
  `requestedVideoId` is empty — fail-safe, never shows a false overlay.

### Wrapper integration (`TVClient`, `FullscreenPlayer`)

Both already hold the `ytPlayer` ref (`onPlayerReady={setYtPlayer}`) and know
`currentPlaying.id`. They call `useAdMask(ytPlayer, currentPlaying.id, isPlaying)`
and combine its result with the existing MC gate:

- `volume = (isMcGated || isAdGated) ? 0 : volume`
- `onPlayingChange` suppressed while either gate is active (so the ad does not
  echo pause/play state into Firebase).
- **Precedence:** MC gate wins when both are active (MC is intentional; ad is
  inferred). The ad overlay never covers an MC announcement.

### `AdIntermissionOverlay` — new presentational component

- Sibling of `MCAnnouncementOverlay`; rendered over the video when `isAdGated`.
- Fully opaque so the ad underneath is never visible.
- Content: branded intermission panel — next song title + a friendly line
  (en/vi via the existing locale bundles), optional subtle spinner.

### `VideoPlayer.tsx` stays almost untouched

It already mutes when `volume === 0`. The gate just drives volume to 0 and the
wrapper paints the overlay. No new YouTube API surface, no player fork.

## Edge cases & safety

- **Null player / empty videoId** → mask disarmed (fail-safe).
- **Unparseable / empty `getVideoUrl()`** → `detectAd` returns `false` (treat as
  "not an ad"; do not flash the overlay on a transient empty read).
- **Stuck overlay** → hard safety timeout (≈45 s cap) force-clears the gate
  regardless of readings, so a bad value can never freeze the room.
- **Flicker** → debounce both arm and disarm edges against brief `getVideoUrl()`
  blips (require the signal to hold across consecutive polls).
- **Non-PLAYING states** → `detectAd` returns `false` unless state is PLAYING,
  so buffering/cued/paused never arm the gate.
- **MC + ad overlap** → MC precedence (above).
- **Cleanup** → poll interval and safety timeout cleared on unmount / song
  change.

## Testing

Per the repo testing policy (Vitest + Testing Library + Playwright):

- **Vitest — `detectAd`** (mock the player handle):
  - returns `true` when PLAYING and `getVideoUrl()` id ≠ requested id
  - returns `false` when ids match
  - returns `false` when not PLAYING
  - returns `false` on empty/unparseable URL
  - returns `false` (swallows) when a getter throws
- **Vitest — `useAdMask`** (mock the player handle + fake timers):
  - arms after the ad signal holds across the debounce window
  - disarms after the song signal holds across the debounce window
  - stays disarmed when `player` is null or `requestedVideoId` is empty
  - respects the safety timeout (force-clear)
  - clears interval + timeout on unmount
- **Vitest + Testing Library — `AdIntermissionOverlay`**: renders next-song
  text when gated; renders nothing when not.
- **Playwright** — real ads are non-deterministic and cannot be reliably
  E2E'd, so assert the **gate** behavior with a faked detector signal (force
  `isAdGated`) rather than waiting on a real ad. This limitation is called out
  explicitly here.
- **Phase 0 spike** — throwaway instrumentation; no tests; findings recorded
  in this spec.

## Files (anticipated)

Source:
- `bk-web/hooks/useAdMask.ts` — `detectAd` probe + `useAdMask` gate (new)
- `bk-web/components/AdIntermissionOverlay.tsx` — overlay (new)
- `bk-web/features/tv/TVClient.tsx` — wire `useAdMask` + overlay
- `bk-web/features/remote/components/FullscreenPlayer.tsx` — wire `useAdMask` +
  overlay
- `bk-shared/src/locales/{en,vi}.json` — intermission strings (`adMask.*`)

Tests:
- `bk-web/hooks/useAdMask.test.ts` — `detectAd` + `useAdMask` unit tests
- `bk-web/components/AdIntermissionOverlay.test.tsx` — component test
- `bk-web/e2e/...` Playwright spec asserting gate behavior via forced signal
