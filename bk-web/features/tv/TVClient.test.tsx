import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, cleanup } from '@testing-library/react';

// Hoisted state so vi.mock factories (which run before the imports below) can
// reference it, and individual tests can mutate it before render.
const state = vi.hoisted(() => ({
  isMcGated: false as boolean,
  isAdGated: false as boolean,
  mcText: null as string | null,
  videoPlayerProps: null as Record<string, unknown> | null,
  setIsPlayingMock: vi.fn(),
  togglePlayPauseMock: vi.fn(),
  playNextMock: vi.fn(),
  playPreviousMock: vi.fn(),
  isPlaying: true as boolean,
  history: [] as unknown[],
  queue: [] as unknown[],
  currentPlaying: {
    id: 'abc123',
    title: 'Test Song',
    channel: 'Test Channel',
    thumbnail: 'https://example.com/thumb.jpg',
    duration: '3:30',
  } as Record<string, unknown> | null,
  // Captured by the EndScreenOverlay mock so tests can drive the outro
  // visibility transition (true ↔ false) without faking real timers.
  outroOnVisibleChange: null as ((visible: boolean) => void) | null,
}));

vi.mock('@bs-kara/shared/hooks', () => ({
  useRoom: () => ({
    roomData: {
      queue: state.queue,
      currentPlaying: state.currentPlaying,
      isPlaying: state.isPlaying,
      volume: 80,
      history: state.history,
      isAutoRandomMode: false,
      randomFilters: {},
      playedHistory: [],
      dragDropEnabled: true,
      requesterPromptEnabled: true,
      isMCEnabled: true,
      mcVoice: 'vi-VN-Neural2-A',
      lastAnnouncedSongId: null,
      isTvActive: false,
      lastEndedAt: null,
    },
    isLoading: false,
    playNext: state.playNextMock,
    playPrevious: state.playPreviousMock,
    togglePlayPause: state.togglePlayPauseMock,
    resetRoom: vi.fn(),
    setIsPlaying: state.setIsPlayingMock,
    addToPlayedHistory: vi.fn(),
    setCurrentPlayingDirectly: vi.fn(),
    tryClaimAnnouncementLock: vi.fn(),
  }),
  useTransientNotice: () => ({ notice: null, show: vi.fn() }),
}));

vi.mock('@/hooks/useMCPlayer', () => ({
  useMCPlayer: () => ({ isMcGated: state.isMcGated, mcText: state.mcText }),
}));

vi.mock('@/hooks/useAdMask', () => ({
  useAdMask: () => ({ isAdGated: state.isAdGated }),
}));

vi.mock('@/components/AdIntermissionOverlay', () => ({
  AdIntermissionOverlay: () => <div data-testid="ad-intermission-overlay" />,
}));

vi.mock('@/hooks/useAutoRandom', () => ({ useAutoRandom: () => {} }));
vi.mock('@/hooks/useAutoHide', () => ({
  useAutoHide: () => ({ visible: true, bump: vi.fn() }),
}));

vi.mock('@/features/tv/hooks/useTVPresence', () => ({
  useTVPresence: vi.fn(() => ({
    phase: 'active' as const,
    roomCode: '1234',
    joinUrl: 'http://localhost:3000/?room=1234',
    activateRoomByCode: vi.fn(),
    resolveRoomCode: vi.fn(),
    setGuestsAllowed: vi.fn(),
  })),
}));

vi.mock('@/lib/firebase', () => ({ db: {} }));

vi.mock('firebase/database', () => ({
  getDatabase: vi.fn(),
  ref: vi.fn(),
  set: vi.fn().mockResolvedValue(undefined),
  remove: vi.fn().mockResolvedValue(undefined),
  update: vi.fn().mockResolvedValue(undefined),
  push: vi.fn(),
  runTransaction: vi.fn(),
  onValue: vi.fn(() => () => {}),
  onChildAdded: vi.fn(() => () => {}),
  query: vi.fn((r) => r),
  orderByChild: vi.fn(),
  startAfter: vi.fn(),
  onDisconnect: () => ({
    cancel: vi.fn().mockResolvedValue(undefined),
    remove: vi.fn().mockResolvedValue(undefined),
  }),
}));

vi.mock('qrcode.react', () => ({
  QRCodeSVG: ({ value, size }: { value: string; size: number }) => (
    <div data-testid="qr-code" data-value={value} data-size={size} />
  ),
}));

vi.mock('next/image', () => ({
  default: () => null,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@/components/VideoPlayer', () => ({
  VideoPlayer: (props: Record<string, unknown>) => {
    state.videoPlayerProps = props;
    return <div data-testid="video-player" />;
  },
}));

vi.mock('@/components/EmojiLayer', () => ({
  EmojiLayer: () => null,
}));

vi.mock('@/components/EndScreenOverlay', () => ({
  EndScreenOverlay: ({
    onVisibleChange,
  }: {
    onVisibleChange?: (visible: boolean) => void;
  }) => {
    state.outroOnVisibleChange = onVisibleChange ?? null;
    return <div data-testid="end-screen-overlay" />;
  },
}));

vi.mock('@/components/ConfirmDialog', () => ({
  ConfirmDialog: () => null,
}));

import TVClient from './TVClient';

describe('TVClient — MC gate / video autoplay', () => {
  beforeEach(() => {
    state.isMcGated = false;
    state.isAdGated = false;
    state.mcText = null;
    state.videoPlayerProps = null;
    state.setIsPlayingMock = vi.fn();
    state.togglePlayPauseMock = vi.fn();
    state.playNextMock = vi.fn();
    state.playPreviousMock = vi.fn();
    state.isPlaying = true;
    state.history = [];
    state.queue = [];
    state.currentPlaying = {
      id: 'abc123',
      title: 'Test Song',
      channel: 'Test Channel',
      thumbnail: 'https://example.com/thumb.jpg',
      duration: '3:30',
    };
    state.outroOnVisibleChange = null;
  });

  afterEach(() => {
    cleanup();
  });

  // Regression: previously the TV unmounted VideoPlayer entirely while
  // isMcGated was true, then remounted it with autoplay=1 after the MC
  // finished speaking. By that point the user gesture from the Waiting
  // Room tap had expired, so Chrome blocked unmuted autoplay and forced
  // the user to click play. Keeping the iframe mounted across the gate
  // (paused + muted) ensures the iframe loads inside the fresh gesture
  // and a later play() call is allowed.
  it('keeps the VideoPlayer mounted while MC is announcing (paused + muted)', async () => {
    state.isMcGated = true;
    state.mcText = 'Welcome the next singer!';

    render(<TVClient />);
    // Simulate the user's first interaction so isInitialized flips true
    // and the player branch renders.
    const waiting = await screen.findByRole('button', { name: /waiting room/i });
    await act(async () => {
      waiting.click();
    });

    expect(screen.getByTestId('video-player')).toBeInTheDocument();
    expect(state.videoPlayerProps).toMatchObject({
      videoId: 'abc123',
      isPlaying: false,
      volume: 0,
    });
    // While MC is speaking we suppress the iframe→React sync to avoid
    // echoing the autoplay-then-pause ping back into shared state.
    expect(state.videoPlayerProps?.onPlayingChange).toBeUndefined();
  });

  it('plays the video unmuted when MC is not gating', async () => {
    state.isMcGated = false;

    render(<TVClient />);
    const waiting = await screen.findByRole('button', { name: /waiting room/i });
    await act(async () => {
      waiting.click();
    });

    expect(state.videoPlayerProps).toMatchObject({
      videoId: 'abc123',
      isPlaying: true,
      volume: 80,
    });
    expect(typeof state.videoPlayerProps?.onPlayingChange).toBe('function');
  });

  // Regression for the iOS pause/play-state-desync bug. Previously
  // useMCKickPlay would optimistically `setIsPlaying(true)` on the
  // gated→ungated edge. On iOS Safari `playVideo()` can be rejected
  // (autoplay policy after the speechSynthesis gesture is consumed),
  // which left Firebase saying playing=true while the iframe sat in
  // CUED — RemoteClient's pause icon then lied about reality.
  //
  // The new contract is:
  //   - `isPlaying` in Firebase represents user intent during the gate.
  //   - We do NOT write to Firebase from the gate transition.
  //   - VideoPlayer's `isPlaying` prop flips false→true on un-gate, and
  //     its own prop-driven effect calls player.playVideo(). If iOS
  //     refuses, the iframe lands in CUED and the broadened
  //     handleStateChange echoes `false` back, self-correcting.
  // The idle screen on the TV should expose a QR code so guests can scan to
  // join. Previously the idle state only showed a Music icon + room-code
  // hint text, which forced the user to type the 4-digit code by hand.
  describe('idle state QR code', () => {
    it('renders the QR code when currentPlaying is null', async () => {
      state.currentPlaying = null;

      render(<TVClient />);
      const waiting = await screen.findByRole('button', { name: /waiting room/i });
      await act(async () => {
        waiting.click();
      });

      // The WaitingOverlay also renders a QR; once isInitialized flips,
      // the WaitingOverlay fades to opacity-0 / pointer-events-none but
      // remains in the DOM. The idle-screen QR is the second one.
      const codes = screen.getAllByTestId('qr-code');
      // At least the idle QR exists — and at least one of them encodes
      // the join URL with the active room code.
      expect(codes.length).toBeGreaterThanOrEqual(1);
      const idle = codes.find((el) => el.getAttribute('data-size') === '280');
      expect(idle).toBeDefined();
      expect(idle?.getAttribute('data-value')).toContain('room=1234');
    });

    it('does NOT render the idle QR when a song is currently playing', async () => {
      state.currentPlaying = {
        id: 'abc123',
        title: 'Test Song',
        channel: 'Test Channel',
        thumbnail: 'https://example.com/thumb.jpg',
        duration: '3:30',
      };

      render(<TVClient />);
      const waiting = await screen.findByRole('button', { name: /waiting room/i });
      await act(async () => {
        waiting.click();
      });

      // Only the WaitingOverlay's QR (size=200) should remain — the
      // size=280 idle QR must not be mounted while a song is playing.
      const codes = screen.queryAllByTestId('qr-code');
      const idle = codes.find((el) => el.getAttribute('data-size') === '280');
      expect(idle).toBeUndefined();
    });
  });

  it('does not write isPlaying to Firebase on the MC gated→ungated edge (no optimistic kick)', async () => {
    // Start gated: simulates the MC announcement actively running.
    state.isMcGated = true;
    state.mcText = 'Welcome the next singer!';

    const { rerender } = render(<TVClient />);
    const waiting = await screen.findByRole('button', { name: /waiting room/i });
    await act(async () => {
      waiting.click();
    });

    // Sanity: nothing has written `isPlaying` yet.
    expect(state.setIsPlayingMock).not.toHaveBeenCalled();

    // MC finishes → gate flips false. roomData.isPlaying stayed `true`
    // throughout (the mock returns true). The contract requires zero
    // Firebase writes from this transition.
    state.isMcGated = false;
    state.mcText = null;
    await act(async () => {
      rerender(<TVClient />);
    });

    expect(state.setIsPlayingMock).not.toHaveBeenCalled();
    // VideoPlayer now sees `isPlaying=true` (un-gated, room intent
    // preserved). Its own useEffect on the `isPlaying` prop is what
    // calls playVideo() — no Firebase round-trip from the kick.
    expect(state.videoPlayerProps).toMatchObject({
      isPlaying: true,
      volume: 80,
    });
  });

  // Regression: previously the EndScreenOverlay was only guarded by !isMcGated.
  // During an ad of ≥16s the player's getCurrentTime()/getDuration() report the
  // AD's timeline, so the outro/confetti condition can be satisfied while the
  // AdIntermissionOverlay is already on screen — the end-screen fires on top of
  // the intermission. The fix adds !isAdGated to the guard so the outro is
  // suppressed for the entire duration of the ad gate.
  //
  // Why this test would FAIL against the old guard: with `{!isMcGated && (` only,
  // isAdGated=true has no effect — EndScreenOverlay mounts regardless, and
  // queryByTestId('end-screen-overlay') would return the element, causing the
  // `not.toBeInTheDocument()` assertion to fail.
  it('does not render the end-screen outro while an ad is masked', async () => {
    state.isAdGated = true;

    render(<TVClient />);
    const waiting = await screen.findByRole('button', { name: /waiting room/i });
    await act(async () => {
      waiting.click();
    });

    // The intermission overlay must be visible while the ad gate is active.
    expect(screen.getByTestId('ad-intermission-overlay')).toBeInTheDocument();
    // The end-screen outro must NOT be mounted — it polls the player clock
    // which during an ad reports the ad's timeline, not the song's.
    expect(screen.queryByTestId('end-screen-overlay')).not.toBeInTheDocument();
  });

  // The TV used to be a passive display — only a fullscreen toggle.
  // Without transport controls the host had to walk to a phone to skip
  // or pause, which broke the "TV is the player" mental model.
  // Regression: any keydown (including Ctrl+Tab for tab switching) must NOT
  // initialize the room. Only an explicit click on the overlay does.
  describe('keydown does not initialize', () => {
    it('does not initialize on any keydown event', async () => {
      render(<TVClient />);
      const waiting = screen.getByRole('button', { name: /waiting room/i });

      for (const key of ['Control', 'Alt', 'Shift', 'Meta', 'Tab', 'Enter', ' ', 'ArrowDown']) {
        await act(async () => {
          window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
        });
      }

      // Overlay still active — only a click should initialize
      expect(waiting.className).not.toContain('pointer-events-none');
      expect(screen.queryByTestId('video-player')).not.toBeInTheDocument();
    });
  });

  describe('transport controls', () => {
    async function renderActivated() {
      const utils = render(<TVClient />);
      const waiting = await screen.findByRole('button', {
        name: /waiting room/i,
      });
      await act(async () => {
        waiting.click();
      });
      return utils;
    }

    it('renders prev / play-pause / next when a song is playing and MC is not gating', async () => {
      await renderActivated();
      expect(
        screen.getByRole('button', { name: 'controls.previousLabel' }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: 'controls.pauseLabel' }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: 'controls.nextLabel' }),
      ).toBeInTheDocument();
    });

    it('shows the play icon (not pause) when playback is paused', async () => {
      state.isPlaying = false;
      await renderActivated();
      expect(
        screen.getByRole('button', { name: 'controls.playLabel' }),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: 'controls.pauseLabel' }),
      ).not.toBeInTheDocument();
    });

    it('clicking the play/pause button calls togglePlayPause with the current isPlaying value', async () => {
      state.isPlaying = true;
      await renderActivated();
      await act(async () => {
        screen.getByRole('button', { name: 'controls.pauseLabel' }).click();
      });
      expect(state.togglePlayPauseMock).toHaveBeenCalledWith(true);
    });

    it('clicking next calls playNext when the queue has items', async () => {
      state.queue = [{ id: 'next-song' }];
      await renderActivated();
      await act(async () => {
        screen.getByRole('button', { name: 'controls.nextLabel' }).click();
      });
      expect(state.playNextMock).toHaveBeenCalled();
    });

    it('clicking prev calls playPrevious when there is history', async () => {
      state.history = [{ id: 'prev-song' }];
      await renderActivated();
      await act(async () => {
        screen.getByRole('button', { name: 'controls.previousLabel' }).click();
      });
      expect(state.playPreviousMock).toHaveBeenCalled();
    });

    it('disables prev when there is no history and next when the queue is empty', async () => {
      state.history = [];
      state.queue = [];
      await renderActivated();
      expect(
        screen.getByRole('button', { name: 'controls.previousLabel' }),
      ).toBeDisabled();
      expect(
        screen.getByRole('button', { name: 'controls.nextLabel' }),
      ).toBeDisabled();
    });

    // Regression: showTransportControls previously lacked !isAdGated, so
    // the prev/play/next cluster stayed visible while an ad overlay covered
    // the player. With the fix, isAdGated=true collapses the transport div
    // to opacity-0 / pointer-events-none — the buttons remain in the DOM
    // but the wrapper is invisible and non-interactive.
    //
    // Why this test would FAIL against the pre-fix code: without !isAdGated
    // in showTransportControls, the wrapper would have className containing
    // 'opacity-100', not 'opacity-0', causing the toContain('opacity-0')
    // assertion to fail.
    it('hides transport controls (opacity-0) while an ad is gated', async () => {
      state.isAdGated = true;
      await renderActivated();
      const playButton = screen.getByRole('button', {
        name: 'controls.pauseLabel',
      });
      const wrapper = playButton.parentElement!;
      expect(wrapper.className).toContain('opacity-0');
      expect(wrapper.className).not.toContain('opacity-100');
    });

    // Regression: the outro previously kept the transport controls mounted
    // and only faded them on a hover/tap timer, so the prev/play/next
    // cluster sat on top of the celebratory headline. The fix is to fade
    // the controls out entirely while the outro is up.
    it('hides the controls completely while the end-of-song outro is visible', async () => {
      await renderActivated();
      // Sanity: controls live in the DOM with the visible class set first.
      const playButton = screen.getByRole('button', {
        name: 'controls.pauseLabel',
      });
      const wrapper = playButton.parentElement!;
      expect(wrapper.className).toContain('opacity-100');
      expect(wrapper.className).not.toContain('opacity-0');

      // Outro fires onVisibleChange(true) when it becomes visible.
      expect(state.outroOnVisibleChange).not.toBeNull();
      await act(async () => {
        state.outroOnVisibleChange?.(true);
      });

      // Same wrapper, controls are now collapsed via opacity-0 — no
      // hover / focus path can bring them back during the outro.
      expect(wrapper.className).toContain('opacity-0');
      expect(wrapper.className).not.toContain('opacity-100');
    });
  });
});
