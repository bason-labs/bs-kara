import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';

// canvas-confetti is a side-effect-only DOM library; jsdom doesn't have a
// canvas, so the tests stub it out entirely.
vi.mock('canvas-confetti', () => ({
  default: vi.fn(),
}));

import { EndScreenOverlay } from '@/components/EndScreenOverlay';
import { VERDICT_TABLE } from '@/lib/scoring';

// Trigger flow: first poll reports an early position (arms the re-trigger
// gate), every later poll reports a near-end position (fires the overlay).
// Two ticks (vi.advanceTimersByTime(600) at 250 ms intervals) walks the
// player from "armed" → "near end".
function makeTriggerPlayer() {
  let calls = 0;
  return {
    getCurrentTime: () => {
      calls += 1;
      return calls <= 1 ? 10 : 56;
    },
    getDuration: () => 60,
  };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('EndScreenOverlay', () => {
  it('does not render ScoreBlock when score prop is null', async () => {
    render(
      <EndScreenOverlay
        player={makeTriggerPlayer()}
        songId="abc"
        score={null}
      />,
    );
    await act(async () => {
      vi.advanceTimersByTime(600);
    });
    // No ScoreBlock means no role="status" element from it.
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('does not render ScoreBlock when score prop is omitted', async () => {
    render(<EndScreenOverlay player={makeTriggerPlayer()} songId="abc" />);
    await act(async () => {
      vi.advanceTimersByTime(600);
    });
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('renders ScoreBlock with state-2 numeric value, tier, and verdict', async () => {
    render(
      <EndScreenOverlay
        player={makeTriggerPlayer()}
        songId="abc"
        score={{ state: 2, value: 87, tier: 'A', verdict: 'A' }}
      />,
    );
    await act(async () => {
      vi.advanceTimersByTime(600);
    });

    // ScoreBlock attaches role="status" — find it inside the overlay.
    const status = screen.getByRole('status');
    expect(status.textContent).toContain('87');
    expect(status.textContent).toContain('A');
    // Verdict text is sourced from VERDICT_TABLE; the test setup pins
    // i18n.language to 'vi' so the vi phrase is what surfaces here.
    expect(status.textContent).toContain(VERDICT_TABLE.A.vi);
  });

  it('blocks pointer events from passing through to the iframe below', async () => {
    // Regression: the outro used to set `pointer-events-none` on its root,
    // which let clicks fall through to the YouTube iframe and pause/open
    // playback while the finale was up. The fix is `pointer-events-auto`.
    const { container } = render(
      <EndScreenOverlay player={makeTriggerPlayer()} songId="abc" />,
    );
    await act(async () => {
      vi.advanceTimersByTime(600);
    });
    const overlay = container.querySelector('.bg-gradient-brand');
    expect(overlay).not.toBeNull();
    expect(overlay).toHaveClass('pointer-events-auto');
    expect(overlay).not.toHaveClass('pointer-events-none');
  });

  it('does not re-trigger the outro on the next song when a stale player reference still reports near-end values', async () => {
    // Regression: TVClient and FullscreenPlayer hold the YouTubePlayer ref
    // in component state across song changes. The iframe is keyed by song
    // id and remounts cleanly, but the ref isn't cleared until the new
    // instance fires onPlayerReady. In that gap the overlay was polling
    // the *previous* song's near-end frame on the new song's gate and
    // re-showing the finale immediately when a song changed. The fix is a
    // re-arming gate that requires a fresh "comfortably away from end"
    // observation per songId before the trigger can fire.
    let currentTime = 10;
    const player = {
      getCurrentTime: () => currentTime,
      getDuration: () => 60,
    };
    const { container, rerender } = render(
      <EndScreenOverlay player={player} songId="A" />,
    );
    // Tick 1 (250 ms): currentTime=10 → remaining=50 → arms the gate.
    // Tick 2 (500 ms): currentTime=56 → remaining=4 → fires the overlay.
    await act(async () => {
      vi.advanceTimersByTime(300);
    });
    currentTime = 56;
    await act(async () => {
      vi.advanceTimersByTime(300);
    });
    expect(container.querySelector('.bg-gradient-brand')).not.toBeNull();

    // Song B starts. The same (now-stale) player ref still reports the
    // previous song's near-end position. Without the per-songId gate this
    // would re-show the outro on song B; with it, the gate is reset and
    // can't arm because remaining (4) is not greater than the
    // 16-second arm threshold.
    rerender(<EndScreenOverlay player={player} songId="B" />);
    await act(async () => {
      vi.advanceTimersByTime(300);
    });
    expect(container.querySelector('.bg-gradient-brand')).toBeNull();
  });

  it('does not mount ScoreBlock until the visibility gate fires', () => {
    // Player at the start of a 60s song — > 8s remaining → overlay invisible.
    const earlyPlayer = {
      getCurrentTime: () => 1,
      getDuration: () => 60,
    };
    render(
      <EndScreenOverlay
        player={earlyPlayer}
        songId="abc"
        score={{ state: 2, value: 87, tier: 'A', verdict: 'A' }}
      />,
    );
    // Without advancing the timer the poll never runs; overlay stays
    // null, so no ScoreBlock either.
    expect(screen.queryByRole('status')).toBeNull();
  });
});
