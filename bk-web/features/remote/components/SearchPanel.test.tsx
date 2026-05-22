import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/tests/msw/server';
import { SearchPanel } from './SearchPanel';

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

// The MSW default handler for /api/youtube/search returns a "Mock result for
// <query>" item, so we can verify the exact query string the BFF received by
// reading the rendered result text. The default hot-hits query is 'bolero'.

describe('SearchPanel', () => {
  it('loads hot hits on mount', async () => {
    render(<SearchPanel onAdd={() => {}} />);
    await waitFor(() =>
      expect(screen.getByText(/Mock result for bolero/)).toBeInTheDocument(),
    );
    expect(screen.getByText('search.hotHitsLabel')).toBeInTheDocument();
  });

  it('shows the idle add (+) button for results not in the queue, and clicking it calls onAdd', async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();
    render(<SearchPanel onAdd={onAdd} />);
    const card = (
      await screen.findByText(/Mock result for bolero/)
    ).closest('div.grid');
    expect(card).not.toBeNull();
    const addBtn = within(card as HTMLElement).getByRole('button', { name: 'search.addAriaLabel' });
    await user.click(addBtn);
    expect(onAdd).toHaveBeenCalledTimes(1);
    expect(onAdd.mock.calls[0][0]).toMatchObject({ id: 'mock-video-1' });
  });

  it('shows the queued state (check icon, no add button) when the video is already in the queue', async () => {
    render(
      <SearchPanel
        onAdd={() => {}}
        queuedMap={new Map([['mock-video-1', 'q123']])}
        queuePositionMap={new Map([['mock-video-1', 3]])}
      />,
    );
    await waitFor(() =>
      expect(screen.getByText(/Mock result for bolero/)).toBeInTheDocument(),
    );
    const card = (
      screen.getByText(/Mock result for bolero/)
    ).closest('div.grid') as HTMLElement;
    // The add button is gone when queued; the queued status pill is shown.
    expect(within(card).queryByRole('button', { name: 'Add' })).toBeNull();
    expect(within(card).getByText(/search\.statusQueued/)).toBeInTheDocument();
  });

  it('marks the now-playing card with the now-playing status and a disabled action', async () => {
    render(
      <SearchPanel
        onAdd={() => {}}
        currentPlayingId="mock-video-1"
      />,
    );
    await waitFor(() =>
      expect(screen.getByText(/Mock result for bolero/)).toBeInTheDocument(),
    );
    const card = (
      screen.getByText(/Mock result for bolero/)
    ).closest('div.grid') as HTMLElement;
    expect(within(card).getByText('search.statusNowPlaying')).toBeInTheDocument();
    const disabled = within(card).getByRole('button', {
      name: 'search.statusNowPlaying',
    });
    expect(disabled).toBeDisabled();
  });

  it('shows the quota error message when search returns quota error', async () => {
    server.use(
      http.get('*/api/youtube/search', () =>
        HttpResponse.json({ error: 'quota' }, { status: 429 }),
      ),
      http.get('*/api/search', () => HttpResponse.json([])),
    );
    const user = userEvent.setup();
    render(<SearchPanel onAdd={() => {}} />);
    const input = screen.getByPlaceholderText('search.placeholder');
    await user.type(input, 'foo{Enter}');
    await waitFor(() =>
      expect(screen.getByText('search.errorQuota')).toBeInTheDocument(),
    );
  });

  describe('search history', () => {
    beforeEach(() => {
      // Seed localStorage so useSearchHistory returns one entry on mount.
      localStorage.setItem(
        'searchHistory',
        JSON.stringify([{ q: 'Duyên phận' }]),
      );
    });

    it('shows history delete button without requiring hover', async () => {
      // The old design used opacity-0 group-hover:opacity-100 to hide the
      // delete button until the row was hovered. The new design removes those
      // classes so the button is always visible without simulating hover.
      const user = userEvent.setup();
      render(<SearchPanel onAdd={() => {}} />);
      // Focus the (empty) input to make the history list appear.
      await user.click(screen.getByPlaceholderText('search.placeholder'));
      // Both mobile inline list and desktop dropdown render the delete button
      // (JSDOM doesn't apply CSS media-query classes like lg:hidden). Check
      // that every rendered delete button lacks opacity-hiding classes.
      await waitFor(() => {
        const deleteBtns = screen.getAllByRole('button', {
          name: 'search.removeHistoryAriaLabel',
        });
        expect(deleteBtns.length).toBeGreaterThan(0);
        for (const btn of deleteBtns) {
          expect(btn.className).not.toMatch(/opacity-0/);
          expect(btn.className).not.toMatch(/group-hover/);
        }
      });
    });
  });

  describe('filters sheet', () => {
    // The filters live in a bottom sheet now — opening it via the Sliders
    // trigger reveals the chips. The same hot-hits MSW handler echoes the
    // final query string back as the result title so we can assert on it.
    it('opens the filters sheet when the trigger is clicked and lets the user toggle a chip', async () => {
      const user = userEvent.setup();
      render(<SearchPanel onAdd={() => {}} />);
      await waitFor(() =>
        expect(screen.getByText(/Mock result for bolero/)).toBeInTheDocument(),
      );
      await user.click(
        screen.getByRole('button', { name: 'search.filtersTriggerAriaLabel' }),
      );
      // Sheet renders all chips — pick "Song ca" and toggle it on.
      const chip = await screen.findByRole('button', { name: 'Song ca' });
      await user.click(chip);
      expect(chip).toHaveAttribute('aria-pressed', 'true');
    });

    it('toggling a chip on its own (no query) triggers a search using just the chip keyword', async () => {
      const user = userEvent.setup();
      render(<SearchPanel onAdd={() => {}} />);
      await waitFor(() =>
        expect(screen.getByText(/Mock result for bolero/)).toBeInTheDocument(),
      );
      await user.click(
        screen.getByRole('button', { name: 'search.filtersTriggerAriaLabel' }),
      );
      await user.click(await screen.findByRole('button', { name: 'Song ca' }));
      await waitFor(() =>
        expect(screen.getByText(/Mock result for song ca/)).toBeInTheDocument(),
      );
    });

    it('combines user query and chip keywords as "<query> <chip keywords>" without dedupe or reorder', async () => {
      const user = userEvent.setup();
      render(<SearchPanel onAdd={() => {}} />);
      await waitFor(() =>
        expect(screen.getByText(/Mock result for bolero/)).toBeInTheDocument(),
      );
      const input = screen.getByPlaceholderText('search.placeholder');
      await user.type(input, 'hello{Enter}');
      await waitFor(() =>
        expect(screen.getByText(/Mock result for hello/)).toBeInTheDocument(),
      );
      // Open filters and toggle two chips while the query is still active —
      // each toggle re-runs the search with all active terms.
      await user.click(
        screen.getByRole('button', { name: 'search.filtersTriggerAriaLabel' }),
      );
      await user.click(await screen.findByRole('button', { name: 'Tone nam' }));
      await user.click(screen.getByRole('button', { name: 'Trữ tình' }));
      await waitFor(() =>
        expect(
          screen.getByText('Mock result for hello tone nam trữ tình'),
        ).toBeInTheDocument(),
      );
    });

    it('shows the active-chip badge count when chips are active', async () => {
      const user = userEvent.setup();
      render(<SearchPanel onAdd={() => {}} />);
      await waitFor(() =>
        expect(screen.getByText(/Mock result for bolero/)).toBeInTheDocument(),
      );
      // Open sheet, toggle two chips
      await user.click(
        screen.getByRole('button', { name: 'search.filtersTriggerAriaLabel' }),
      );
      await user.click(await screen.findByRole('button', { name: 'Song ca' }));
      await user.click(screen.getByRole('button', { name: 'Tone nam' }));
      // The trigger button now has a small badge with the count ("2").
      const trigger = screen.getByRole('button', {
        name: 'search.filtersTriggerAriaLabel',
      });
      // The badge sits in the same container as the trigger.
      const triggerContainer = trigger.parentElement as HTMLElement;
      expect(within(triggerContainer).getByText('2')).toBeInTheDocument();
    });

    it('reset clears every chip — badge disappears and chips return to aria-pressed=false', async () => {
      const user = userEvent.setup();
      render(<SearchPanel onAdd={() => {}} />);
      await waitFor(() =>
        expect(screen.getByText(/Mock result for bolero/)).toBeInTheDocument(),
      );
      await user.click(
        screen.getByRole('button', { name: 'search.filtersTriggerAriaLabel' }),
      );
      await user.click(await screen.findByRole('button', { name: 'Song ca' }));
      await user.click(screen.getByRole('button', { name: 'Tone nam' }));
      // Reset button inside the sheet.
      await user.click(
        screen.getByRole('button', { name: 'search.filtersReset' }),
      );
      expect(
        screen.getByRole('button', { name: 'Song ca' }),
      ).toHaveAttribute('aria-pressed', 'false');
      expect(
        screen.getByRole('button', { name: 'Tone nam' }),
      ).toHaveAttribute('aria-pressed', 'false');
    });

    it('chips persist across submits within the session — typing a fresh query does not reset chips', async () => {
      const user = userEvent.setup();
      render(<SearchPanel onAdd={() => {}} />);
      await waitFor(() =>
        expect(screen.getByText(/Mock result for bolero/)).toBeInTheDocument(),
      );
      await user.click(
        screen.getByRole('button', { name: 'search.filtersTriggerAriaLabel' }),
      );
      await user.click(await screen.findByRole('button', { name: 'Tone nữ' }));
      // Close sheet by clicking the apply CTA (best available role-targetable
      // dismissal; clicking the scrim is also valid but less stable).
      const apply = screen.getByRole('button', {
        name: /search\.filtersApply|search\.filtersViewAll/,
      });
      await user.click(apply);
      const input = screen.getByPlaceholderText('search.placeholder');
      await user.type(input, 'lan{Enter}');
      await waitFor(() =>
        expect(
          screen.getByText('Mock result for lan tone nữ'),
        ).toBeInTheDocument(),
      );
      // Re-open the sheet and confirm the chip is still active. We scope
      // the query inside the dialog because an active-chip pill with the
      // same label is also rendered above the search results.
      await user.click(
        screen.getByRole('button', { name: 'search.filtersTriggerAriaLabel' }),
      );
      await waitFor(() => {
        const dialog = screen.getByRole('dialog');
        const chip = within(dialog).getByText('Tone nữ').closest('button');
        expect(chip).not.toBeNull();
        expect(chip).toHaveAttribute('aria-pressed', 'true');
      });
    });
  });

  describe('just-added celebration', () => {
    it('flips a result card into the just-added state for ~1.7s after onAdd', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      const onAdd = vi.fn();
      render(<SearchPanel onAdd={onAdd} />);
      await waitFor(() =>
        expect(screen.getByText(/Mock result for bolero/)).toBeInTheDocument(),
      );
      const card = (
        screen.getByText(/Mock result for bolero/)
      ).closest('div.grid') as HTMLElement;
      await user.click(within(card).getByRole('button', { name: 'search.addAriaLabel' }));
      expect(onAdd).toHaveBeenCalledTimes(1);
      // Status pill flips to "just added" immediately.
      expect(within(card).getByText('search.statusJustAdded')).toBeInTheDocument();
      // After the 1700ms timer, the just-added state clears (no queuedMap was
      // passed so the card returns to idle and the add button reappears).
      vi.advanceTimersByTime(1800);
      await waitFor(() => {
        expect(
          within(card).queryByText('search.statusJustAdded'),
        ).not.toBeInTheDocument();
      });
      vi.useRealTimers();
    });
  });
});
