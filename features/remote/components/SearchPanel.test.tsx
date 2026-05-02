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
});
