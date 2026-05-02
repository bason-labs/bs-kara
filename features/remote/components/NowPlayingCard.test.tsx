import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { YouTubeVideo } from '@/lib/youtube/types';
import { NowPlayingCard } from './NowPlayingCard';

const track: YouTubeVideo = {
  id: 'a',
  title: 'Track Title',
  channel: 'Channel',
  thumbnail: 'https://example.com/t.jpg',
  duration: '3:30',
};

describe('NowPlayingCard', () => {
  it('renders nothing when track is null', () => {
    const { container } = render(<NowPlayingCard track={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the title and channel', () => {
    render(<NowPlayingCard track={track} />);
    expect(screen.getByText('Track Title')).toBeInTheDocument();
    expect(screen.getByText('Channel')).toBeInTheDocument();
  });

  it('shows the requester pill when provided', () => {
    render(<NowPlayingCard track={{ ...track, requesterName: 'Alice' }} />);
    expect(screen.getByText('Alice')).toBeInTheDocument();
  });

  it('expand button calls onExpand', async () => {
    const onExpand = vi.fn();
    const user = userEvent.setup();
    render(<NowPlayingCard track={track} onExpand={onExpand} />);
    await user.click(screen.getByRole('button', { name: 'player.openFullscreen' }));
    expect(onExpand).toHaveBeenCalledTimes(1);
  });

  it('clicking the card body calls onExpand (mobile tap target)', async () => {
    const onExpand = vi.fn();
    const user = userEvent.setup();
    render(<NowPlayingCard track={track} onExpand={onExpand} />);
    await user.click(screen.getByText('Track Title'));
    expect(onExpand).toHaveBeenCalledTimes(1);
  });

  it('clicking the remove button does not bubble up to onExpand', async () => {
    const onExpand = vi.fn();
    const onRemove = vi.fn();
    const user = userEvent.setup();
    render(
      <NowPlayingCard track={track} onExpand={onExpand} onRemove={onRemove} />,
    );
    await user.click(screen.getByRole('button', { name: 'nowPlaying.removeAriaLabel' }));
    expect(onExpand).not.toHaveBeenCalled();
  });

  it('remove button opens a confirm dialog and only fires onRemove on confirm', async () => {
    const onRemove = vi.fn();
    const user = userEvent.setup();
    render(<NowPlayingCard track={track} onRemove={onRemove} />);
    await user.click(screen.getByRole('button', { name: 'nowPlaying.removeAriaLabel' }));
    expect(screen.getByText('nowPlaying.removeConfirm.title')).toBeInTheDocument();
    expect(onRemove).not.toHaveBeenCalled();
    await user.click(
      screen.getByRole('button', { name: 'nowPlaying.removeConfirm.confirm' }),
    );
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it('cancel from the confirm dialog leaves onRemove alone', async () => {
    const onRemove = vi.fn();
    const user = userEvent.setup();
    render(<NowPlayingCard track={track} onRemove={onRemove} />);
    await user.click(screen.getByRole('button', { name: 'nowPlaying.removeAriaLabel' }));
    await user.click(
      screen.getAllByRole('button', { name: 'nowPlaying.removeConfirm.cancel' })[0],
    );
    expect(onRemove).not.toHaveBeenCalled();
  });
});
