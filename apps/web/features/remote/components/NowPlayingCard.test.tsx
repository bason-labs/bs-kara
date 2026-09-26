import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { YouTubeVideo } from '@bs-kara/shared';
import { NowPlayingCard } from './NowPlayingCard';

const track: YouTubeVideo = {
  id: 'a',
  title: 'Track Title',
  channel: 'Channel',
  thumbnail: 'https://example.com/t.jpg',
  duration: '3:30',
};

const removeButton = () => screen.getByRole('button', { name: 'nowPlaying.removeAriaLabel' });

describe('NowPlayingCard', () => {
  it('renders nothing when track is null', () => {
    const { container } = render(<NowPlayingCard track={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('clicking the card body calls onExpand (mobile tap target)', async () => {
    const onExpand = vi.fn();
    render(<NowPlayingCard track={track} onExpand={onExpand} />);
    await userEvent.click(screen.getByText('Track Title'));
    expect(onExpand).toHaveBeenCalledTimes(1);
  });

  it('clicking the remove button does not bubble up to onExpand', async () => {
    const onExpand = vi.fn();
    render(<NowPlayingCard track={track} onExpand={onExpand} onRemove={vi.fn()} />);
    await userEvent.click(removeButton());
    expect(onExpand).not.toHaveBeenCalled();
  });

  it.each(['compact', 'hero'] as const)(
    '%s variant: remove asks for confirmation and only fires onRemove on confirm',
    async (variant) => {
      const onRemove = vi.fn();
      render(<NowPlayingCard variant={variant} track={track} onRemove={onRemove} />);

      await userEvent.click(removeButton());
      await userEvent.click(
        screen.getAllByRole('button', { name: 'nowPlaying.removeConfirm.cancel' })[0],
      );
      expect(onRemove).not.toHaveBeenCalled();

      await userEvent.click(removeButton());
      await userEvent.click(screen.getByRole('button', { name: 'nowPlaying.removeConfirm.confirm' }));
      expect(onRemove).toHaveBeenCalledTimes(1);
    },
  );
});
