import { act, render, screen } from '@testing-library/react';
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

  // iOS Safari has no screen.orientation.lock() — instead the FullscreenPlayer
  // applies a CSS rotation fallback (.ios-fullscreen-landscape) and toggles
  // it on physical device rotation. The component reads physical orientation
  // from screen.orientation.angle (iOS 16.4+) / window.orientation (legacy);
  // it deliberately does NOT use matchMedia because iOS Safari fires
  // orientationchange / resize events for unrelated viewport changes
  // (URL-bar collapse, fullscreen transitions, keyboard) which would
  // otherwise re-toggle the rotation and break the layout.
  describe('iOS landscape CSS fallback', () => {
    let originalUA: PropertyDescriptor | undefined;
    let originalScreenOrientation: PropertyDescriptor | undefined;
    let originalWindowOrientation: PropertyDescriptor | undefined;
    let originalInnerWidth: number;
    let originalInnerHeight: number;

    function setUserAgent(ua: string) {
      Object.defineProperty(navigator, 'userAgent', {
        configurable: true,
        get: () => ua,
      });
    }

    // Sets the *physical* device orientation that the component reads.
    // angle: 0 = portrait, 90/-90 = landscape, 180 = upside-down portrait.
    function setDeviceAngle(angle: number) {
      Object.defineProperty(window.screen, 'orientation', {
        configurable: true,
        value: { angle, type: angle === 0 ? 'portrait-primary' : 'landscape-primary' },
      });
      Object.defineProperty(window, 'orientation', {
        configurable: true,
        value: angle,
      });
      // Mirror the viewport so width/height assertions match real iOS behavior.
      const isLandscape = Math.abs(angle) === 90;
      Object.defineProperty(window, 'innerWidth', {
        configurable: true,
        value: isLandscape ? 800 : 400,
      });
      Object.defineProperty(window, 'innerHeight', {
        configurable: true,
        value: isLandscape ? 400 : 800,
      });
    }

    beforeEach(() => {
      mockGated = false;
      // Silence the diagnostic logging the iOS effect emits in production
      // so the test runner doesn't drown in console output.
      vi.spyOn(console, 'log').mockImplementation(() => {});
      originalUA = Object.getOwnPropertyDescriptor(navigator, 'userAgent');
      originalScreenOrientation = Object.getOwnPropertyDescriptor(
        window.screen,
        'orientation',
      );
      originalWindowOrientation = Object.getOwnPropertyDescriptor(window, 'orientation');
      originalInnerWidth = window.innerWidth;
      originalInnerHeight = window.innerHeight;
      setDeviceAngle(0);
    });

    afterEach(() => {
      if (originalUA) Object.defineProperty(navigator, 'userAgent', originalUA);
      if (originalScreenOrientation) {
        Object.defineProperty(window.screen, 'orientation', originalScreenOrientation);
      } else {
        delete (window.screen as unknown as { orientation?: unknown }).orientation;
      }
      if (originalWindowOrientation) {
        Object.defineProperty(window, 'orientation', originalWindowOrientation);
      } else {
        delete (window as unknown as { orientation?: unknown }).orientation;
      }
      Object.defineProperty(window, 'innerWidth', {
        configurable: true,
        value: originalInnerWidth,
      });
      Object.defineProperty(window, 'innerHeight', {
        configurable: true,
        value: originalInnerHeight,
      });
    });

    function fireOrientationChange() {
      // Wrapping in act() flushes the resulting React state update before
      // we read the DOM — without it, the className is the pre-event value.
      act(() => {
        window.dispatchEvent(new Event('orientationchange'));
      });
    }

    it('applies the rotation class on iOS in portrait', () => {
      setUserAgent(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
      );
      setDeviceAngle(0);
      const { container } = render(<FullscreenPlayer {...baseProps} />);
      const wrapper = container.querySelector('[role="dialog"]') as HTMLElement;
      expect(wrapper.classList.contains('ios-fullscreen-landscape')).toBe(true);
    });

    it('does NOT apply the rotation class when iOS is already in landscape', () => {
      setUserAgent(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
      );
      setDeviceAngle(90);
      const { container } = render(<FullscreenPlayer {...baseProps} />);
      const wrapper = container.querySelector('[role="dialog"]') as HTMLElement;
      expect(wrapper.classList.contains('ios-fullscreen-landscape')).toBe(false);
    });

    it('removes the rotation on physical rotation to landscape, re-applies on rotation back to portrait', () => {
      setUserAgent(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
      );
      setDeviceAngle(0);
      const { container } = render(<FullscreenPlayer {...baseProps} />);
      const wrapper = container.querySelector('[role="dialog"]') as HTMLElement;
      expect(wrapper.classList.contains('ios-fullscreen-landscape')).toBe(true);

      setDeviceAngle(90);
      fireOrientationChange();
      expect(wrapper.classList.contains('ios-fullscreen-landscape')).toBe(false);

      setDeviceAngle(0);
      fireOrientationChange();
      expect(wrapper.classList.contains('ios-fullscreen-landscape')).toBe(true);
    });

    // Regression for the production bug: iOS fires orientationchange (and
    // resize / visualViewport.resize) for URL-bar / fullscreen-transition
    // reasons while the device is still in the same physical orientation.
    // The old matchMedia-based logic would re-toggle, breaking the layout.
    // Spurious events must be no-ops.
    it('does not re-toggle on spurious orientationchange when physical orientation is unchanged', () => {
      setUserAgent(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
      );
      setDeviceAngle(0);
      const { container } = render(<FullscreenPlayer {...baseProps} />);
      const wrapper = container.querySelector('[role="dialog"]') as HTMLElement;
      expect(wrapper.classList.contains('ios-fullscreen-landscape')).toBe(true);

      // Simulate iOS Safari URL-bar collapse: innerHeight grows but the
      // device is still physically portrait (angle stays 0). Even if
      // matchMedia would now flip, physical orientation is still portrait,
      // so the rotation class must stay on.
      Object.defineProperty(window, 'innerHeight', {
        configurable: true,
        value: 880,
      });
      fireOrientationChange();
      fireOrientationChange();
      fireOrientationChange();

      expect(wrapper.classList.contains('ios-fullscreen-landscape')).toBe(true);
    });

    // Regression for the actual root cause uncovered in production:
    //   The wrapper's className is recomputed every render
    //   (`${chromeVisible ? '' : 'cursor-none'}`). When useAutoHide flips
    //   chromeVisible, React replaces the entire className attribute,
    //   wiping out any class added imperatively via classList.add().
    //   The class must survive arbitrary re-renders — i.e. it must be
    //   owned by React's render output, not poked onto the DOM.
    it('keeps the rotation class through a re-render that changes other classes', () => {
      setUserAgent(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
      );
      setDeviceAngle(0);
      const { container, rerender } = render(<FullscreenPlayer {...baseProps} />);
      const wrapper = container.querySelector('[role="dialog"]') as HTMLElement;
      expect(wrapper.classList.contains('ios-fullscreen-landscape')).toBe(true);

      // Force a re-render by changing a prop. In production the same
      // attribute swap happens whenever useAutoHide flips chromeVisible
      // (which it does ~2.5s after mount or on tap).
      rerender(<FullscreenPlayer {...baseProps} isPlaying={!baseProps.isPlaying} />);
      expect(wrapper.classList.contains('ios-fullscreen-landscape')).toBe(true);
    });

    it('does not touch the class on non-iOS browsers (Android keeps its native lock path)', () => {
      setUserAgent(
        'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/120',
      );
      setDeviceAngle(0);
      const { container } = render(<FullscreenPlayer {...baseProps} />);
      const wrapper = container.querySelector('[role="dialog"]') as HTMLElement;
      expect(wrapper.classList.contains('ios-fullscreen-landscape')).toBe(false);
    });

    it('removes the wrapper from the document on unmount', () => {
      setUserAgent(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
      );
      setDeviceAngle(0);
      const { container, unmount } = render(<FullscreenPlayer {...baseProps} />);
      expect(container.querySelector('[role="dialog"]')).not.toBeNull();
      unmount();
      // React owns the rotation class via render output, so on unmount the
      // entire wrapper leaves the DOM — the class goes away with the node.
      expect(container.querySelector('[role="dialog"]')).toBeNull();
    });
  });
});
