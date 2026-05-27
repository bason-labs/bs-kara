import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Hoisted state lets the tests reconfigure room/gate mocks between renders
// while the vi.mock factories (which run before imports) read live values.
const state = vi.hoisted(() => ({
  isTvActive: false as boolean,
  isPlaying: true as boolean,
  isLoading: false as boolean,
  tab: 'search' as 'search' | 'queue' | 'player' | 'settings',
  togglePlayPauseMock: vi.fn(),
  setIsPlayingMock: vi.fn(),
  fullscreenPlayerProps: null as Record<string, unknown> | null,
  primeAudioMock: vi.fn(),
  requestFullscreenMock: vi.fn().mockResolvedValue(undefined),
  // claim() is async (Firebase round-trip in real life). Tests can swap in a
  // manually-controlled promise to assert the *ordering* of side effects
  // around the await — see the requestFullscreen-must-be-synchronous tests.
  claimMock: vi.fn().mockResolvedValue(true) as ReturnType<typeof vi.fn>,
  releaseMock: vi.fn().mockResolvedValue(undefined) as ReturnType<typeof vi.fn>,
}));

const baseTrack = {
  id: 'abc',
  title: 'Test Song',
  channel: 'Test Channel',
  thumbnail: 'https://example.com/t.jpg',
  duration: '3:00',
};

vi.mock('@bs-kara/shared/hooks', () => ({
  // useTransientNotice: minimal stub — tests here don't exercise notices.
  useTransientNotice: () => ({ notice: null, show: vi.fn() }),
  useRoom: () => ({
      roomData: {
        queue: [],
        currentPlaying: baseTrack,
        isPlaying: state.isPlaying,
        volume: 80,
        history: [],
        isAutoRandomMode: false,
        randomFilters: {},
        playedHistory: [],
        dragDropEnabled: true,
        requesterPromptEnabled: true,
        isMCEnabled: true,
        mcVoice: 'vi-VN-Neural2-A',
        lastAnnouncedSongId: null,
        isTvActive: state.isTvActive,
        // Explicitly null (not undefined) so isExpandBlocked stays false in the
        // tests' default world — `roomData.fullscreenOwner !== null` would
        // otherwise be true for `undefined`, which hides the expand button.
        fullscreenOwner: null,
        lastEndedAt: null,
      },
      isLoading: state.isLoading,
      roomExists: true,
      addSongToQueue: vi.fn(),
      updateRequesterName: vi.fn(),
      removeSong: vi.fn(),
      reorderQueue: vi.fn(),
      togglePlayPause: state.togglePlayPauseMock,
      setIsPlaying: state.setIsPlayingMock,
      playNext: vi.fn(),
      playPrevious: vi.fn(),
      sendEmoji: vi.fn(),
      setAutoRandomMode: vi.fn(),
      setRandomFilters: vi.fn(),
      setDragDropEnabled: vi.fn(),
      setRequesterPromptEnabled: vi.fn(),
      setMCEnabled: vi.fn(),
      setMcVoice: vi.fn(),
      tryClaimAnnouncementLock: vi.fn(),
      removeCurrentPlaying: vi.fn(),
      addToPlayedHistory: vi.fn(),
      setCurrentPlayingDirectly: vi.fn(),
    }),
}));

vi.mock('@/hooks/useAutoRandom', () => ({ useAutoRandom: () => {} }));

// useFullscreenOwnership pulls in firebase/database; under vitest there is no
// Firebase env, so importing it crashes module load. Stub it with mocks the
// tests can introspect (claim/release are the integration points the
// expand & play handlers depend on).
vi.mock('@/features/remote/hooks/useFullscreenOwnership', () => ({
  useFullscreenOwnership: () => ({
    deviceId: 'test-device',
    claim: state.claimMock,
    release: state.releaseMock,
  }),
}));

// Pin the gate to a known state so RemoteClient renders the room shell.
vi.mock('@/features/remote/hooks/useRoomGate', () => ({
  useRoomGate: () => ({
    rawRoomCode: '1234',
    roomCode: '1234',
    isCoarsePointer: true,
    joinError: null,
    isJoining: false,
    submitJoin: vi.fn(),
    handleLeave: vi.fn(),
  }),
}));

// useInactivityTimeout pulls in Firebase; stub it so the test harness
// never hits the real database layer.
vi.mock('@/features/remote/hooks/useInactivityTimeout', () => ({
  useInactivityTimeout: () => ({
    timedOut: false,
    rejoinReason: null,
    resetActivity: vi.fn(),
    rejoin: vi.fn().mockResolvedValue(undefined),
  }),
}));

// Avoid pulling the real requester-dialog flow into the harness; the tests
// here are about the play/pause path.
vi.mock('@/features/remote/hooks/useRequesterDialog', () => ({
  useRequesterDialog: () => ({
    handleAddToQueue: vi.fn(),
    handleEditRequester: vi.fn(),
    handleRequesterConfirm: vi.fn(),
    closeRequesterDialog: vi.fn(),
    dialogOpen: false,
    dialogMode: 'add' as const,
    dialogKey: 0,
    dialogInitialName: '',
    toastSong: null,
    dismissToast: vi.fn(),
  }),
}));

vi.mock('@/features/remote/hooks/useQueuedMap', () => ({
  useQueuedMap: () => ({}),
}));

vi.mock('@/hooks/useAIVoice', () => ({
  primeAudio: () => state.primeAudioMock(),
  // Real module exports more, but RemoteClient only consumes primeAudio.
}));

// Stub heavy children so the test focuses on the controls' wiring.
vi.mock('@/features/remote/components/SearchPanel', () => ({
  SearchPanel: () => <div data-testid="search-panel" />,
}));

vi.mock('@/features/remote/components/ClientQueue', () => ({
  ClientQueue: () => <div data-testid="client-queue" />,
}));

vi.mock('@/features/remote/components/EmojiPad', () => ({
  EmojiPad: () => <div data-testid="emoji-pad" />,
}));

vi.mock('@/components/EmojiLayer', () => ({
  EmojiLayer: () => null,
}));

vi.mock('@/features/remote/components/NeonOrbs', () => ({
  NeonOrbs: () => null,
}));

vi.mock('@/features/remote/components/ThemeToggle', () => ({
  ThemeToggle: () => null,
}));

vi.mock('@/features/remote/components/AddedToast', () => ({
  AddedToast: () => null,
}));

vi.mock('@/features/remote/components/RequesterDialog', () => ({
  RequesterDialog: () => null,
}));

vi.mock('@/features/remote/components/JoinForm', () => ({
  JoinForm: () => null,
}));

vi.mock('@/features/remote/components/NowPlayingCard', () => ({
  NowPlayingCard: ({
    isPlaying,
    onExpand,
  }: {
    isPlaying?: boolean;
    onExpand?: () => void;
  }) => (
    <div data-testid="now-playing" data-playing={String(isPlaying)}>
      {onExpand && (
        <button type="button" onClick={onExpand}>
          mock-expand
        </button>
      )}
    </div>
  ),
}));

// FullscreenPlayer is a heavy component — mock it and capture props so the
// test can assert mount + the isPlaying it receives.
vi.mock('@/features/remote/components/FullscreenPlayer', () => ({
  FullscreenPlayer: (props: Record<string, unknown>) => {
    state.fullscreenPlayerProps = props;
    return <div data-testid="fullscreen-player" />;
  },
}));

// If something in RemoteClient's main (non-expanded) view ever started
// importing qrcode.react, this stub gives us a stable testid to assert
// against. The expected count on the main view is zero — the QR lives
// only on the TV idle screen and inside FullscreenPlayer's idle state.
vi.mock('qrcode.react', () => ({
  QRCodeSVG: ({ value }: { value: string }) => (
    <div data-testid="qr-code" data-value={value} />
  ),
}));

vi.mock('next/dynamic', () => ({
  default: () => () => null,
}));

vi.mock('@/features/remote/hooks/useTabParam', () => ({
  useTabParam: () => [state.tab, vi.fn()],
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

// Stub the Fullscreen API jsdom doesn't implement.
beforeEach(() => {
  state.isTvActive = false;
  state.isPlaying = true;
  state.isLoading = false;
  state.tab = 'search';
  state.togglePlayPauseMock = vi.fn();
  state.setIsPlayingMock = vi.fn();
  state.fullscreenPlayerProps = null;
  state.primeAudioMock = vi.fn();
  state.requestFullscreenMock = vi.fn().mockResolvedValue(undefined);
  state.claimMock = vi.fn().mockResolvedValue(true);
  state.releaseMock = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(document.documentElement, 'requestFullscreen', {
    configurable: true,
    value: state.requestFullscreenMock,
  });
});

afterEach(() => {
  cleanup();
  delete (document.documentElement as unknown as { requestFullscreen?: unknown })
    .requestFullscreen;
});

import RemoteClient from './RemoteClient';

describe('RemoteClient — play/pause UI when no playback surface is mounted', () => {
  // Bug 2: with no TV connected and FullscreenPlayer not open, no one is
  // actually playing — the remote button must reflect that even if Firebase
  // still says playing=true (e.g. stale state from a prior session).
  it('renders the Play icon when !isTvActive && !playerOpen even though roomData.isPlaying === true', async () => {
    state.isTvActive = false;
    state.isPlaying = true;
    render(<RemoteClient />);
    // The play/pause button uses translation keys for its aria-label; the
    // Play label proves the displayed state is "paused".
    expect(
      await screen.findByRole('button', { name: 'controls.playLabel' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'controls.pauseLabel' }),
    ).not.toBeInTheDocument();
  });

  // Bug 2 — the equalizer animation in NowPlayingCard is driven by the same
  // displayed flag; it must not animate while no surface hosts the iframe.
  it('passes displayedIsPlaying=false to NowPlayingCard when !isTvActive && !playerOpen', () => {
    state.isTvActive = false;
    state.isPlaying = true;
    render(<RemoteClient />);
    const card = screen.getAllByTestId('now-playing')[0];
    expect(card.getAttribute('data-playing')).toBe('false');
  });

  // Tap the play button when no surface exists → open FullscreenPlayer.
  // The user's tap is what gives iOS Safari the gesture token it needs to
  // autoplay once the iframe mounts inside FullscreenPlayer.
  it('tapping the play button opens FullscreenPlayer and does NOT toggle Firebase isPlaying', async () => {
    state.isTvActive = false;
    state.isPlaying = false; // also covers the "Firebase says paused" case
    const user = userEvent.setup();
    render(<RemoteClient />);
    const playBtn = await screen.findByRole('button', {
      name: 'controls.playLabel',
    });
    await user.click(playBtn);
    expect(screen.getByTestId('fullscreen-player')).toBeInTheDocument();
    expect(state.togglePlayPauseMock).not.toHaveBeenCalled();
  });

  // The QR code lives on the TV idle screen and inside the expanded
  // FullscreenPlayer's idle state — NOT on RemoteClient's main
  // (non-expanded) view. Adding it here would clutter the search/queue/
  // player tabs that already work fine without one.
  it('does not render a QR code on the main (non-expanded) view', () => {
    state.isTvActive = false;
    state.isPlaying = true;
    render(<RemoteClient />);
    expect(screen.queryByTestId('qr-code')).not.toBeInTheDocument();
  });

  // Regression: commit a94ab01 ("implement fullscreen ownership management")
  // wrapped requestFullscreen behind `await claim()`. After an await the
  // user-gesture activation token is consumed in most browsers, so either
  //   (a) requestFullscreen is rejected (no fullscreen at all), or
  //   (b) the engine briefly enters fullscreen and then exits as untrusted —
  //       FullscreenPlayer's own fullscreenchange listener interprets the
  //       exit as an explicit close and unmounts the overlay.
  // The visible symptom was: tap expand → screen flashes fullscreen → closes.
  // Fix: requestFullscreen MUST run synchronously in the click handler,
  // before any await. Asserted here by holding claim() pending and checking
  // requestFullscreen was called anyway.
  it('handleExpand calls requestFullscreen synchronously, before awaiting claim()', async () => {
    state.isTvActive = false;
    state.isPlaying = false;
    // Never-resolving claim — exposes any code that awaits before the
    // fullscreen request.
    state.claimMock = vi.fn(() => new Promise<boolean>(() => {}));
    const user = userEvent.setup();
    render(<RemoteClient />);
    const expandBtn = (await screen.findAllByText('mock-expand'))[0];
    await user.click(expandBtn);
    expect(state.requestFullscreenMock).toHaveBeenCalledTimes(1);
    // claim() should also have been invoked (in parallel, not sequenced
    // before the fullscreen request).
    expect(state.claimMock).toHaveBeenCalledTimes(1);
  });

  // Inverse case: with the TV active, the remote is the actual control
  // surface — taps should write to Firebase as before. Display must mirror
  // Firebase's truth.
  it('renders state from roomData.isPlaying and calls togglePlayPause when isTvActive', async () => {
    state.isTvActive = true;
    state.isPlaying = true;
    const user = userEvent.setup();
    render(<RemoteClient />);
    const pauseBtn = await screen.findByRole('button', {
      name: 'controls.pauseLabel',
    });
    await user.click(pauseBtn);
    expect(state.togglePlayPauseMock).toHaveBeenCalledTimes(1);
    expect(state.togglePlayPauseMock).toHaveBeenCalledWith(true);
  });
});

describe('RemoteClient — per-tab skeleton loading', () => {
  it('shows the queue skeleton when isLoading=true and tab=queue', () => {
    state.isLoading = true;
    state.tab = 'queue';
    render(<RemoteClient />);
    expect(screen.getByTestId('queue-skeleton')).toBeInTheDocument();
  });

  it('shows the search skeleton when isLoading=true and tab=search', () => {
    state.isLoading = true;
    state.tab = 'search';
    render(<RemoteClient />);
    expect(screen.getByTestId('search-skeleton')).toBeInTheDocument();
  });
});
