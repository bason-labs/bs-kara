import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/components/VideoPlayer', () => ({
  VideoPlayer: () => <div data-testid="yt-stub" />,
}));

vi.mock('@/components/EmojiLayer', () => ({
  EmojiLayer: () => <div data-testid="emoji-layer" />,
}));

let mockGated = false;
vi.mock('@/hooks/useMCPlayer', () => ({
  useMCPlayer: () => ({ isMcGated: mockGated, mcText: mockGated ? 'Hi!' : null }),
}));

import { FullscreenPlayer } from './FullscreenPlayer';

const baseTrack = {
  id: 'a',
  title: 'A Song',
  channel: 'C',
  thumbnail: '',
  duration: '',
};

const baseProps = {
  track: baseTrack,
  roomId: '1234',
  isPlaying: true,
  volume: 50,
  hasHistory: false,
  hasQueue: false,
  isMCEnabled: true,
  mcVoice: 'vi-VN-Neural2-A',
  onSongEnd: vi.fn(),
  onClose: vi.fn(),
  onPrev: vi.fn(),
  onNext: vi.fn(),
};

describe('FullscreenPlayer', () => {
  it('renders the close button and the YouTube stub', () => {
    mockGated = false;
    render(<FullscreenPlayer {...baseProps} />);
    expect(screen.getByRole('button', { name: 'player.closeFullscreen' })).toBeInTheDocument();
    expect(screen.getByTestId('yt-stub')).toBeInTheDocument();
  });

  it('Escape fires onClose', async () => {
    mockGated = false;
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<FullscreenPlayer {...baseProps} onClose={onClose} />);
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
  });

  it('shows the MC announcement banner when gated', () => {
    mockGated = true;
    render(<FullscreenPlayer {...baseProps} />);
    expect(screen.getByText('aiMc.announcing')).toBeInTheDocument();
    // The mcText from the hook surfaces in the banner.
    expect(screen.getByText(/Hi!/)).toBeInTheDocument();
  });

  it('clicking the close button fires onClose', async () => {
    mockGated = false;
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<FullscreenPlayer {...baseProps} onClose={onClose} />);
    await user.click(screen.getByRole('button', { name: 'player.closeFullscreen' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
