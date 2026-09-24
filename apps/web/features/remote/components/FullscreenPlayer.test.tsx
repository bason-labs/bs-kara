import { StrictMode } from 'react';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/components/VideoPlayer', () => ({
  VideoPlayer: () => <div data-testid="yt-stub" />,
}));

vi.mock('@/components/EmojiLayer', () => ({
  EmojiLayer: () => <div data-testid="emoji-layer" />,
}));

vi.mock('qrcode.react', () => ({
  QRCodeSVG: ({ value, size }: { value: string; size: number }) => (
    <div data-testid="qr-code" data-value={value} data-size={size} />
  ),
}));

let mockGated = false;
vi.mock('@/hooks/useMCPlayer', () => ({
  useMCPlayer: () => ({ isMcGated: mockGated, mcText: mockGated ? 'Hi!' : null }),
}));

let mockAdGated = false;
vi.mock('@/hooks/useAdMask', () => ({
  useAdMask: () => ({ isAdGated: mockAdGated }),
}));

vi.mock('@/components/AdIntermissionOverlay', () => ({
  AdIntermissionOverlay: () => <div data-testid="ad-intermission-overlay" />,
}));

vi.mock('@/components/EndScreenOverlay', () => ({
  EndScreenOverlay: () => <div data-testid="end-screen-overlay" />,
}));

// useSongScore subscribes to Firebase at module load. The test runs
// without env, so swap in a stub that mirrors the off-toggle behaviour.
vi.mock('@/hooks/useSongScore', () => ({
  useSongScore: () => null,
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
  aiScoringEnabled: false,
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

  // Regression: the FullscreenPlayer's own top-bar close button is hidden
  // while the MC is speaking (opacity-0 + pointer-events-none). Without a
  // close button inside the overlay, the user would be locked into
  // fullscreen for the duration of the announcement. The overlay receives
  // `onClose` and renders its own close affordance.
  it('keeps a close button reachable while the MC is gated', async () => {
    mockGated = true;
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<FullscreenPlayer {...baseProps} onClose={onClose} />);
    const closeButtons = screen.getAllByRole('button', {
      name: 'player.closeFullscreen',
    });
    // The overlay's button is the one that's visually + functionally
    // reachable while gated (the top-bar button is opacity-0 / pointer-
    // events-none). Tap it and confirm onClose fires.
    await user.click(closeButtons[closeButtons.length - 1]);
    expect(onClose).toHaveBeenCalled();
  });

  it('clicking the close button fires onClose', async () => {
    mockGated = false;
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<FullscreenPlayer {...baseProps} onClose={onClose} />);
    await user.click(screen.getByRole('button', { name: 'player.closeFullscreen' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // Regression: there used to be an aria-hidden tap-bump button overlaying
  // the iframe whose sole job was to bump the auto-hide chrome on touch
  // (the iframe lives in its own document, so window-level listeners in
  // useAutoHide can't see those touches). It also intercepted every click
  // on YouTube's native controls (timeline scrubber, play/pause, fullscreen
  // toggle) — which VideoPlayer enables in dev (commit d4090b7) — making
  // the player effectively read-only.
  // TVClient's video surface has no such layer and works correctly; this
  // overlay mirrors that. Trade-off: chrome may stay hidden once the user
  // is interacting with the iframe; pausing or hitting an existing button
  // re-bumps it.
  it('does not render a tap-bump layer over the iframe (YouTube native controls must be reachable)', () => {
    mockGated = false;
    const { container } = render(<FullscreenPlayer {...baseProps} />);
    const tapLayer = container.querySelector(
      'button[aria-hidden="true"][tabindex="-1"]',
    );
    expect(tapLayer).toBeNull();
  });

  // Regression: in dev (Next.js defaults reactStrictMode=true), every effect
  // is double-invoked on mount: mount → cleanup → mount. If FullscreenPlayer
  // owns an unmount effect that calls document.exitFullscreen() while
  // fullscreenElement is set, the Strict Mode bounce will exit fullscreen
  // immediately after entering, the close-on-fs-exit listener at line ~263
  // catches the resulting fullscreenchange, and onClose fires — the user
  // sees the overlay flash open and close instantly. The fix is to NOT
  // exit fullscreen from within FullscreenPlayer's lifecycle; the parent
  // (RemoteClient) handles fullscreen exit at every real close path.
  it('does not call onClose during a Strict Mode mount bounce while fullscreen is active', async () => {
    mockGated = false;
    // Pretend the browser is currently in fullscreen (entered by the
    // parent's click handler before FullscreenPlayer mounted).
    Object.defineProperty(document, 'fullscreenElement', {
      configurable: true,
      get: () => document.documentElement,
    });
    // Simulate the real-browser behavior: exitFullscreen resolves async,
    // and only after that does fullscreenElement clear and a
    // fullscreenchange (exit) event fire.
    const exitFullscreen = vi.fn().mockImplementation(() => {
      queueMicrotask(() => {
        Object.defineProperty(document, 'fullscreenElement', {
          configurable: true,
          get: () => null,
        });
        document.dispatchEvent(new Event('fullscreenchange'));
      });
      return Promise.resolve();
    });
    (document as unknown as { exitFullscreen: () => Promise<void> }).exitFullscreen =
      exitFullscreen;

    const onClose = vi.fn();
    await act(async () => {
      render(
        <StrictMode>
          <FullscreenPlayer {...baseProps} onClose={onClose} />
        </StrictMode>,
      );
      // Flush any pending microtasks from the simulated fullscreenchange.
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(onClose).not.toHaveBeenCalled();

    // Cleanup: restore fullscreen API stubs.
    delete (document as unknown as { fullscreenElement?: unknown }).fullscreenElement;
    delete (document as unknown as { exitFullscreen?: unknown }).exitFullscreen;
  });

  // Regression: previously the EndScreenOverlay was only guarded by !isMcGated.
  // During an ad of ≥16s the player's getCurrentTime()/getDuration() report the
  // AD's timeline, so the outro/confetti condition can be satisfied while the
  // AdIntermissionOverlay is already on screen. The fix adds !isAdGated to the
  // guard.
  //
  // Why this test would FAIL against the old guard: with `{!isMcGated && (` only,
  // isAdGated=true has no effect on whether EndScreenOverlay mounts — it would
  // still render, and queryByTestId('end-screen-overlay') would return the element,
  // causing the `not.toBeInTheDocument()` assertion to fail.
  it('does not render the end-screen outro while an ad is masked', () => {
    mockGated = false;
    mockAdGated = true;
    render(<FullscreenPlayer {...baseProps} />);

    // The intermission overlay must be present while the ad gate is active.
    expect(screen.getByTestId('ad-intermission-overlay')).toBeInTheDocument();
    // The end-screen outro must NOT be mounted — it polls the player clock
    // which during an ad reports the ad's timeline, not the song's.
    expect(screen.queryByTestId('end-screen-overlay')).not.toBeInTheDocument();

    mockAdGated = false;
  });

  // Regression: showCenterControls previously lacked !isAdGated, so the
  // prev/play/next buttons were visible while the AdIntermissionOverlay
  // covered the player. The fix adds !isAdGated to the guard so the
  // center transport is not rendered during an ad.
  //
  // Why this test would FAIL against the pre-fix code: without !isAdGated
  // in showCenterControls, the buttons would still mount when isAdGated is
  // true, so queryByRole('button', { name: 'player.pause' }) would return
  // an element, causing the not.toBeInTheDocument() assertion to fail.
  it('hides center transport controls (not rendered) while an ad is gated', () => {
    mockGated = false;
    mockAdGated = true;
    render(<FullscreenPlayer {...baseProps} />);

    // The ad intermission overlay must be present.
    expect(screen.getByTestId('ad-intermission-overlay')).toBeInTheDocument();
    // The play/pause button is the center transport sentinel — it must NOT
    // be in the DOM while the ad gate is active.
    expect(
      screen.queryByRole('button', { name: 'player.pause' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'controls.previousLabel' }),
    ).not.toBeInTheDocument();

    mockAdGated = false;
  });

  // Regression: when a song ends on mobile and the queue is empty, the
  // FullscreenPlayer must NOT unmount (which would drop the user back to
  // the RemoteClient). It must stay mounted with an idle placeholder so
  // the next song added to the queue resumes inside the same surface.
  describe('idle state (track === null)', () => {
    it('stays mounted when track transitions from a song to null', () => {
      mockGated = false;
      const { container, rerender } = render(<FullscreenPlayer {...baseProps} />);
      expect(container.querySelector('[role="dialog"]')).not.toBeNull();
      rerender(<FullscreenPlayer {...baseProps} track={null} />);
      expect(container.querySelector('[role="dialog"]')).not.toBeNull();
    });

    it('renders the idle QR (encoded with the room code) and no YouTube iframe when track is null', () => {
      mockGated = false;
      render(<FullscreenPlayer {...baseProps} track={null} />);
      const qr = screen.getByTestId('qr-code');
      expect(qr).toBeInTheDocument();
      // The QR encodes the join URL with the active room code so guests
      // can scan and land in the same room.
      expect(qr.getAttribute('data-value')).toContain('room=1234');
      expect(screen.queryByTestId('yt-stub')).not.toBeInTheDocument();
    });

    it('does NOT render the idle QR when a song is loaded', () => {
      mockGated = false;
      render(<FullscreenPlayer {...baseProps} />);
      // With a real track, the iframe takes over — the idle QR must not be
      // present (the QR is only for the empty/idle state).
      expect(screen.queryByTestId('qr-code')).not.toBeInTheDocument();
    });

    // Regression: the close (X) button must remain reachable on the idle
    // QR screen. The top bar previously auto-hid 2.5s after mount via
    // chromeVisible, which would strand the user on the QR screen with
    // no visible way out. We keep the bar always-on while track is null.
    it('keeps the close button reachable on the idle QR screen', async () => {
      mockGated = false;
      const user = userEvent.setup();
      const onClose = vi.fn();
      render(<FullscreenPlayer {...baseProps} track={null} onClose={onClose} />);
      const closeBtn = screen.getByRole('button', { name: 'player.closeFullscreen' });
      await user.click(closeBtn);
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('auto-loads the new video when track transitions from null to a song', () => {
      mockGated = false;
      const { rerender } = render(<FullscreenPlayer {...baseProps} track={null} />);
      expect(screen.queryByTestId('yt-stub')).not.toBeInTheDocument();

      rerender(<FullscreenPlayer {...baseProps} track={baseTrack} />);
      // The iframe is back (same surface, no unmount of the dialog wrapper).
      expect(screen.getByTestId('yt-stub')).toBeInTheDocument();
    });

    it('does not call onClose when track flips to null (only the explicit close button does)', () => {
      mockGated = false;
      const onClose = vi.fn();
      const { rerender } = render(
        <FullscreenPlayer {...baseProps} onClose={onClose} />,
      );
      rerender(<FullscreenPlayer {...baseProps} track={null} onClose={onClose} />);
      expect(onClose).not.toHaveBeenCalled();
    });
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
