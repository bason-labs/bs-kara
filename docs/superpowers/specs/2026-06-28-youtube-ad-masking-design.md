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

**Primary signal — duration mismatch.** Each song carries its real `duration`
(populated by search/BFF metadata on `currentPlaying`). `player.getDuration()`
reports the timeline of whatever is currently on screen; during a pre-roll or
mid-roll ad that is the **ad's** duration, not the song's.

Detection rule (polled at the existing 250 ms cadence used by
`EndScreenOverlay`):

- State is `PLAYING`, **and**
- `player.getDuration() > 0` (metadata loaded; ignore buffering), **and**
- reported duration differs from the known song duration beyond a tolerance
  → `isAdLikely = true` → mute + overlay.
- When reported duration returns to ~the expected song length →
  `isAdLikely = false` → unmute + uncover.

**Honest limitations:** this is a heuristic. It can false-positive (stored
duration wrong) or miss (ad length ≈ song length). Mitigations below.

### Phase 0 — validation spike (do first, throwaway)

Before building the feature, instrument a real ad-bearing video and log over
time:

- `player.getDuration()`
- `player.getCurrentTime()`
- `player.getVideoData().video_id`

Confirm the duration-mismatch signal behaves as expected during pre-roll and
mid-roll ads, and tune the tolerance / debounce / safety-timeout constants. If
duration-mismatch proves flaky, evaluate `getVideoData().video_id` mismatch
(requested videoId vs reported) as a backup or composite signal. The spike is
instrumentation only — not shipped, no tests — but its findings are recorded
back into this spec.

## Architecture

Model ad masking on the existing **MC gate** pattern (`useMCPlayer` /
`isMcGated`), which already does "mute + cover + suppress state echo". This
composes with the current code instead of fighting it.

### `useAdMask(player, expectedDurationSeconds, isPlaying)` — new hook

- Location: `hooks/` (next to `useMCPlayer`).
- Returns `{ isAdGated }`.
- Owns: the 250 ms poll, the duration-mismatch rule, edge debounce, and the
  safety timeout. Clears its interval on unmount / song change.
- Disarmed (returns `isAdGated: false` always) when `expectedDurationSeconds`
  is missing/invalid — fail-safe, never shows a false overlay.

### Wrapper integration (`TVClient`, `FullscreenPlayer`)

Both already hold the `ytPlayer` ref (`onPlayerReady={setYtPlayer}`) and know
`currentPlaying.duration`. They call `useAdMask` and combine its result with the
existing MC gate:

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

- **Unknown/missing duration** → mask disarmed for that song (fail-safe).
- **Duration parsing** → add `durationToSeconds()` helper in `lib/` if one does
  not already exist (with unit tests). Tolerance ≈ a few seconds, plus a
  "min ad gap" so a coincidentally-close song does not trip the gate.
- **Stuck overlay** → hard safety timeout (≈45 s cap) force-clears the gate
  regardless of readings, so a bad value can never freeze the room.
- **Flicker** → debounce both arm and disarm edges against brief `getDuration()`
  blips.
- **Pre-roll timing** → ignore `getDuration() === 0`; act only on a real,
  mismatched value.
- **MC + ad overlap** → MC precedence (above).
- **Cleanup** → poll interval cleared on unmount / song change.

## Testing

Per the repo testing policy (Vitest + Testing Library + Playwright):

- **Vitest — `useAdMask`** (mock the player ref):
  - arms when reported duration ≠ expected while `PLAYING`
  - disarms when reported duration matches expected
  - stays disarmed when `expectedDurationSeconds` is unknown
  - respects tolerance / min-ad-gap
  - respects the safety timeout (force-clear)
  - debounces arm/disarm edges
- **Vitest — `durationToSeconds()`** (if added): formats + empty/edge inputs.
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
- `bk-web/hooks/useAdMask.ts` — detection + gate logic (new)
- `bk-web/components/AdIntermissionOverlay.tsx` — overlay (new)
- `bk-web/lib/...durationToSeconds` helper (new, if not present)
- `bk-web/features/tv/TVClient.tsx` — wire `useAdMask` + overlay
- `bk-web/features/remote/components/FullscreenPlayer.tsx` — wire `useAdMask` +
  overlay
- `bk-web/locales/{en,vi}` — intermission strings

Tests:
- `useAdMask` unit tests
- `AdIntermissionOverlay` component test
- `durationToSeconds` unit tests (if added)
- Playwright spec asserting gate behavior via forced signal
