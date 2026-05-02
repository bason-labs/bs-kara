import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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

  // Regression: tapping the fullscreen button on mobile should rotate the screen
  // to landscape (YouTube-app parity). The Screen Orientation API is gated on
  // fullscreen being active, so we simulate that here.
  describe('screen orientation', () => {
    let lock: ReturnType<typeof vi.fn>;
    let unlock: ReturnType<typeof vi.fn>;
    let originalOrientation: PropertyDescriptor | undefined;
    let originalFullscreenElement: PropertyDescriptor | undefined;
    let originalExitFullscreen: (() => Promise<void>) | undefined;

    beforeEach(() => {
      mockGated = false;
      lock = vi.fn().mockResolvedValue(undefined);
      unlock = vi.fn();
      originalOrientation = Object.getOwnPropertyDescriptor(window.screen, 'orientation');
      Object.defineProperty(window.screen, 'orientation', {
        configurable: true,
        value: { lock, unlock, type: 'portrait-primary', angle: 0 },
      });
      originalFullscreenElement = Object.getOwnPropertyDescriptor(document, 'fullscreenElement');
      Object.defineProperty(document, 'fullscreenElement', {
        configurable: true,
        get: () => document.documentElement,
      });
      // jsdom lacks the Fullscreen API; stub exitFullscreen so the existing
      // unmount cleanup branch doesn't crash these tests.
      originalExitFullscreen = (
        document as unknown as { exitFullscreen?: () => Promise<void> }
      ).exitFullscreen;
      (document as unknown as { exitFullscreen: () => Promise<void> }).exitFullscreen =
        () => Promise.resolve();
    });

    afterEach(() => {
      if (originalOrientation) {
        Object.defineProperty(window.screen, 'orientation', originalOrientation);
      } else {
        // jsdom default has no `orientation` — strip the one we added.
        delete (window.screen as unknown as { orientation?: unknown }).orientation;
      }
      if (originalFullscreenElement) {
        Object.defineProperty(document, 'fullscreenElement', originalFullscreenElement);
      } else {
        delete (document as unknown as { fullscreenElement?: unknown }).fullscreenElement;
      }
      if (originalExitFullscreen) {
        (document as unknown as { exitFullscreen: () => Promise<void> }).exitFullscreen =
          originalExitFullscreen;
      } else {
        delete (document as unknown as { exitFullscreen?: unknown }).exitFullscreen;
      }
    });

    it('locks to landscape on mount when fullscreen is active', () => {
      render(<FullscreenPlayer {...baseProps} />);
      expect(lock).toHaveBeenCalledWith('landscape');
    });

    it('unlocks on unmount', () => {
      const { unmount } = render(<FullscreenPlayer {...baseProps} />);
      unmount();
      expect(unlock).toHaveBeenCalledTimes(1);
    });

    it('does not throw when the Screen Orientation API is unavailable', () => {
      delete (window.screen as unknown as { orientation?: unknown }).orientation;
      expect(() => {
        const { unmount } = render(<FullscreenPlayer {...baseProps} />);
        unmount();
      }).not.toThrow();
    });

    it('swallows lock() promise rejection (unsupported orientation)', () => {
      lock.mockReturnValueOnce(Promise.reject(new Error('NotSupportedError')));
      expect(() => render(<FullscreenPlayer {...baseProps} />)).not.toThrow();
    });
  });
});
