import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';

// canvas-confetti is a side-effect-only DOM library; jsdom doesn't have a
// canvas, so the tests stub it out entirely.
vi.mock('canvas-confetti', () => ({
  default: vi.fn(),
}));

import { EndScreenOverlay } from '@/components/EndScreenOverlay';
import { VERDICT_TABLE } from '@/lib/scoring';

// Trigger when remaining < 8s — pick currentTime / duration so the overlay
// goes visible after the first poll tick.
const triggerPlayer = {
  getCurrentTime: () => 56,
  getDuration: () => 60,
};

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
        player={triggerPlayer}
        songId="abc"
        score={null}
      />,
    );
    await act(async () => {
      vi.advanceTimersByTime(300);
    });
    // No ScoreBlock means no role="status" element from it.
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('does not render ScoreBlock when score prop is omitted', async () => {
    render(<EndScreenOverlay player={triggerPlayer} songId="abc" />);
    await act(async () => {
      vi.advanceTimersByTime(300);
    });
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('renders ScoreBlock with state-2 numeric value, tier, and verdict', async () => {
    render(
      <EndScreenOverlay
        player={triggerPlayer}
        songId="abc"
        score={{ state: 2, value: 87, tier: 'A', verdict: 'A' }}
      />,
    );
    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    // ScoreBlock attaches role="status" — find it inside the overlay.
    const status = screen.getByRole('status');
    expect(status.textContent).toContain('87');
    expect(status.textContent).toContain('A');
    // Verdict text is sourced from VERDICT_TABLE; the test setup pins
    // i18n.language to 'vi' so the vi phrase is what surfaces here.
    expect(status.textContent).toContain(VERDICT_TABLE.A.vi);
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
