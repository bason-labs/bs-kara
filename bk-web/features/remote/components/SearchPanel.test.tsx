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

    it('clicking Apply after toggling a chip triggers a search using just the chip keyword', async () => {
      const user = userEvent.setup();
      render(<SearchPanel onAdd={() => {}} />);
      await waitFor(() =>
        expect(screen.getByText(/Mock result for bolero/)).toBeInTheDocument(),
      );
      await user.click(
        screen.getByRole('button', { name: 'search.filtersTriggerAriaLabel' }),
      );
      await user.click(await screen.findByRole('button', { name: 'Song ca' }));
      // Toggling alone must NOT trigger a search — only Apply should.
      expect(screen.queryByText(/Mock result for song ca/)).not.toBeInTheDocument();
      await user.click(
        screen.getByRole('button', { name: /search\.filtersApply|search\.filtersViewAll/ }),
      );
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
      // Open filters, toggle two chips, then Apply — search only fires on Apply.
      await user.click(
        screen.getByRole('button', { name: 'search.filtersTriggerAriaLabel' }),
      );
      await user.click(await screen.findByRole('button', { name: 'Tone nam' }));
      await user.click(screen.getByRole('button', { name: 'Trữ tình' }));
      await user.click(
        screen.getByRole('button', { name: /search\.filtersApply|search\.filtersViewAll/ }),
      );
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
      // Open sheet, toggle two chips, Apply — badge only updates on Apply.
      await user.click(
        screen.getByRole('button', { name: 'search.filtersTriggerAriaLabel' }),
      );
      await user.click(await screen.findByRole('button', { name: 'Song ca' }));
      await user.click(screen.getByRole('button', { name: 'Tone nam' }));
      await user.click(
        screen.getByRole('button', { name: /search\.filtersApply|search\.filtersViewAll/ }),
      );
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

  describe('re-focus after search', () => {
    it('shows history after clearing the query following a search', async () => {
      // The bug: after a search, `searched` stayed true, so clearing the
      // query kept showResults=true and history never appeared.
      localStorage.setItem(
        'searchHistory',
        JSON.stringify([{ q: 'Duyên phận' }]),
      );
      const user = userEvent.setup();
      render(<SearchPanel onAdd={() => {}} />);
      const input = screen.getByPlaceholderText('search.placeholder');
      await user.type(input, 'hello{Enter}');
      await waitFor(() =>
        expect(screen.getByText(/Mock result for hello/)).toBeInTheDocument(),
      );
      // Clear the query with the X button — history should now reappear.
      await user.click(screen.getByRole('button', { name: 'search.clearAriaLabel' }));
      // Both mobile inline list and desktop dropdown render in JSDOM
      // (media queries aren't applied), so we expect multiple matches.
      await waitFor(() =>
        expect(screen.getAllByText('Duyên phận').length).toBeGreaterThan(0),
      );
    });

    it('returns to history mode when re-focusing the input after a search then blurring', async () => {
      localStorage.setItem(
        'searchHistory',
        JSON.stringify([{ q: 'Duyên phận' }]),
      );
      const user = userEvent.setup();
      render(<SearchPanel onAdd={() => {}} />);
      const input = screen.getByPlaceholderText('search.placeholder');
      await user.type(input, 'hello{Enter}');
      await waitFor(() =>
        expect(screen.getByText(/Mock result for hello/)).toBeInTheDocument(),
      );
      // Blur, clear, then re-focus — history should reappear.
      await user.tab();
      await user.clear(input);
      await user.click(input);
      await waitFor(() =>
        expect(screen.getAllByText('Duyên phận').length).toBeGreaterThan(0),
      );
    });
  });

  describe('desktop background while typing', () => {
    // Bug: typing from the idle hot-hits view on desktop made hot hits
    // disappear, leaving the suggestion dropdown floating over a blank
    // content area. The fix keeps hot hits mounted underneath the overlay
    // on desktop only (the lg: breakpoint = min-width: 1024px). Mobile
    // keeps the existing inline typing list since there is no room for
    // an overlay.
    const originalMatchMedia = window.matchMedia;

    function mockViewport(isDesktop: boolean) {
      window.matchMedia = ((query: string) => ({
        matches: query.includes('min-width: 1024px') ? isDesktop : false,
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      })) as typeof window.matchMedia;
    }

    afterEach(() => {
      window.matchMedia = originalMatchMedia;
    });

    it('keeps hot hits visible while typing on desktop', async () => {
      mockViewport(true);
      const user = userEvent.setup();
      render(<SearchPanel onAdd={() => {}} />);
      // Wait for hot hits to load on mount.
      await waitFor(() =>
        expect(screen.getByText(/Mock result for bolero/)).toBeInTheDocument(),
      );
      const input = screen.getByPlaceholderText('search.placeholder');
      await user.click(input);
      await user.type(input, 'h');
      // Hot hits must remain in the DOM even while typing on desktop —
      // the suggestion dropdown is an absolute overlay above them.
      expect(screen.getByText(/Mock result for bolero/)).toBeInTheDocument();
    });

    it('hides hot hits while typing on mobile (no room for overlay)', async () => {
      mockViewport(false);
      const user = userEvent.setup();
      render(<SearchPanel onAdd={() => {}} />);
      await waitFor(() =>
        expect(screen.getByText(/Mock result for bolero/)).toBeInTheDocument(),
      );
      const input = screen.getByPlaceholderText('search.placeholder');
      await user.click(input);
      await user.type(input, 'h');
      // On mobile the inline typing list replaces the content area; hot
      // hits must unmount.
      await waitFor(() =>
        expect(
          screen.queryByText(/Mock result for bolero/),
        ).not.toBeInTheDocument(),
      );
    });

    it('does not show stale results when re-focusing the input after a desktop search', async () => {
      mockViewport(true);
      const user = userEvent.setup();
      render(<SearchPanel onAdd={() => {}} />);
      const input = screen.getByPlaceholderText('search.placeholder');
      await user.type(input, 'hello{Enter}');
      await waitFor(() =>
        expect(screen.getByText(/Mock result for hello/)).toBeInTheDocument(),
      );
      // Blur, then re-focus — the input still holds 'hello' but the
      // results must clear (current behavior is preserved by the fix).
      await user.tab();
      await user.click(input);
      await waitFor(() =>
        expect(
          screen.queryByText(/Mock result for hello/),
        ).not.toBeInTheDocument(),
      );
    });
  });
});
