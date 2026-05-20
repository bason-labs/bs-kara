import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/tests/msw/server';
import { SearchPanel } from './SearchPanel';

afterEach(() => vi.restoreAllMocks());

describe('SearchPanel', () => {
  it('loads hot hits on mount', async () => {
    render(<SearchPanel onAdd={() => {}} />);
    // The default MSW handler for /api/youtube/search returns a "Mock result"
    // for whatever query — DEFAULT_HOT_HITS_QUERY = 'bolero'.
    await waitFor(() =>
      expect(screen.getByText(/Mock result for bolero/)).toBeInTheDocument(),
    );
    expect(screen.getByText('search.hotHitsLabel')).toBeInTheDocument();
  });

  it('shows + Add button for results not in the queue, and the user can add them', async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();
    render(<SearchPanel onAdd={onAdd} />);
    await waitFor(() =>
      expect(screen.getByText(/Mock result for bolero/)).toBeInTheDocument(),
    );
    await user.click(screen.getByRole('button', { name: 'search.addToQueueButton' }));
    expect(onAdd).toHaveBeenCalledTimes(1);
    expect(onAdd.mock.calls[0][0]).toMatchObject({ id: 'mock-video-1' });
  });

  it('shows the "Added" state when the video is already in the queue', async () => {
    render(
      <SearchPanel
        onAdd={() => {}}
        onRemove={() => {}}
        queuedMap={new Map([['mock-video-1', 'q123']])}
      />,
    );
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'search.addedToQueueButton' }),
      ).toBeInTheDocument(),
    );
  });

  it('clicking the added state calls onRemove with the queueId', async () => {
    const user = userEvent.setup();
    const onRemove = vi.fn();
    render(
      <SearchPanel
        onAdd={() => {}}
        onRemove={onRemove}
        queuedMap={new Map([['mock-video-1', 'q123']])}
      />,
    );
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'search.addedToQueueButton' }),
      ).toBeInTheDocument(),
    );
    await user.click(
      screen.getByRole('button', { name: 'search.addedToQueueButton' }),
    );
    expect(onRemove).toHaveBeenCalledWith('q123');
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
    await user.type(input, 'foo');
    await user.click(
      screen.getByRole('button', { name: 'search.submitAriaLabel' }),
    );
    await waitFor(() =>
      expect(screen.getByText('search.errorQuota')).toBeInTheDocument(),
    );
  });

  describe('quick filter chips', () => {
    // The MSW default handler echoes the query back as the result title
    // ("Mock result for ${q}"), so we can verify the exact query string the
    // BFF received by reading the rendered result text.
    it('renders all 6 quick-filter chips with aria-pressed=false initially', async () => {
      render(<SearchPanel onAdd={() => {}} />);
      // Wait for hot hits to settle so the chip row is mounted.
      await waitFor(() =>
        expect(screen.getByText(/Mock result for bolero/)).toBeInTheDocument(),
      );
      const labels = ['Song ca', 'Tone nam', 'Tone nữ', 'Trữ tình', 'Ca cổ', 'Nhạc trẻ'];
      for (const label of labels) {
        const chip = screen.getByRole('button', { name: label });
        expect(chip).toHaveAttribute('aria-pressed', 'false');
      }
    });

    it('toggling a chip on its own (no query) triggers a search using just the chip keyword', async () => {
      const user = userEvent.setup();
      render(<SearchPanel onAdd={() => {}} />);
      await waitFor(() =>
        expect(screen.getByText(/Mock result for bolero/)).toBeInTheDocument(),
      );
      await user.click(screen.getByRole('button', { name: 'Song ca' }));
      await waitFor(() =>
        expect(screen.getByText(/Mock result for song ca/)).toBeInTheDocument(),
      );
      expect(
        screen.getByRole('button', { name: 'Song ca' }),
      ).toHaveAttribute('aria-pressed', 'true');
    });

    it('combines user query and chip keywords as "<query> <chip keywords>" without dedupe or reorder', async () => {
      const user = userEvent.setup();
      render(<SearchPanel onAdd={() => {}} />);
      await waitFor(() =>
        expect(screen.getByText(/Mock result for bolero/)).toBeInTheDocument(),
      );
      const input = screen.getByPlaceholderText('search.placeholder');
      await user.type(input, 'hello');
      await user.click(
        screen.getByRole('button', { name: 'search.submitAriaLabel' }),
      );
      await waitFor(() =>
        expect(screen.getByText(/Mock result for hello/)).toBeInTheDocument(),
      );
      // Now toggle two chips while the user query is still active — the
      // re-run search must fire with all three terms in chip-definition
      // order, query first.
      await user.click(screen.getByRole('button', { name: 'Tone nam' }));
      await user.click(screen.getByRole('button', { name: 'Trữ tình' }));
      await waitFor(() =>
        expect(
          screen.getByText('Mock result for hello tone nam trữ tình'),
        ).toBeInTheDocument(),
      );
    });

    it('multi-select: tapping a second chip keeps the first active (AND, not radio)', async () => {
      const user = userEvent.setup();
      render(<SearchPanel onAdd={() => {}} />);
      await waitFor(() =>
        expect(screen.getByText(/Mock result for bolero/)).toBeInTheDocument(),
      );
      await user.click(screen.getByRole('button', { name: 'Song ca' }));
      await user.click(screen.getByRole('button', { name: 'Tone nam' }));
      expect(
        screen.getByRole('button', { name: 'Song ca' }),
      ).toHaveAttribute('aria-pressed', 'true');
      expect(
        screen.getByRole('button', { name: 'Tone nam' }),
      ).toHaveAttribute('aria-pressed', 'true');
      await waitFor(() =>
        expect(
          screen.getByText('Mock result for song ca tone nam'),
        ).toBeInTheDocument(),
      );
    });

    it('clear-all button appears only when ≥1 chip is active and resets every chip', async () => {
      const user = userEvent.setup();
      render(<SearchPanel onAdd={() => {}} />);
      await waitFor(() =>
        expect(screen.getByText(/Mock result for bolero/)).toBeInTheDocument(),
      );
      // No active chip → no clear button
      expect(
        screen.queryByRole('button', { name: 'search.clearFiltersAriaLabel' }),
      ).not.toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Song ca' }));
      await user.click(screen.getByRole('button', { name: 'Tone nam' }));

      const clearBtn = await screen.findByRole('button', {
        name: 'search.clearFiltersAriaLabel',
      });
      await user.click(clearBtn);

      expect(
        screen.getByRole('button', { name: 'Song ca' }),
      ).toHaveAttribute('aria-pressed', 'false');
      expect(
        screen.getByRole('button', { name: 'Tone nam' }),
      ).toHaveAttribute('aria-pressed', 'false');
      expect(
        screen.queryByRole('button', { name: 'search.clearFiltersAriaLabel' }),
      ).not.toBeInTheDocument();
    });

    it('chips persist across submits within the session — typing a fresh query does not reset chips', async () => {
      const user = userEvent.setup();
      render(<SearchPanel onAdd={() => {}} />);
      await waitFor(() =>
        expect(screen.getByText(/Mock result for bolero/)).toBeInTheDocument(),
      );
      await user.click(screen.getByRole('button', { name: 'Tone nữ' }));
      const input = screen.getByPlaceholderText('search.placeholder');
      await user.type(input, 'lan');
      await user.click(
        screen.getByRole('button', { name: 'search.submitAriaLabel' }),
      );
      await waitFor(() =>
        expect(
          screen.getByText('Mock result for lan tone nữ'),
        ).toBeInTheDocument(),
      );
      // Chip is still active after the submit.
      expect(
        screen.getByRole('button', { name: 'Tone nữ' }),
      ).toHaveAttribute('aria-pressed', 'true');
    });
  });
});
