import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Hoisted state lets the tests reconfigure room/gate mocks between renders
// while the vi.mock factories (which run before imports) read live values.
const state = vi.hoisted(() => ({
  isTvActive: false as boolean,
  isPlaying: true as boolean,
  togglePlayPauseMock: vi.fn(),
  setIsPlayingMock: vi.fn(),
  fullscreenPlayerProps: null as Record<string, unknown> | null,
  primeAudioMock: vi.fn(),
  requestFullscreenMock: vi.fn().mockResolvedValue(undefined),
}));

const baseTrack = {
  id: 'abc',
  title: 'Test Song',
  channel: 'Test Channel',
  thumbnail: 'https://example.com/t.jpg',
  duration: '3:00',
};

vi.mock('@/hooks/useRoom', () => ({
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
      lastEndedAt: null,
    },
    isLoading: false,
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

// Pin the gate to a known state so RemoteClient renders the room shell.
vi.mock('@/features/remote/hooks/useRoomGate', () => ({
  useRoomGate: () => ({
    rawRoomCode: '1234',
    roomCode: '1234',
    activeRoom: '1234',
    pointerLoaded: true,
    isCoarsePointer: true,
    submitJoin: vi.fn(),
    handleLeave: vi.fn(),
    forgetSavedRoom: vi.fn(),
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
  NowPlayingCard: ({ isPlaying }: { isPlaying?: boolean }) => (
    <div data-testid="now-playing" data-playing={String(isPlaying)} />
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

vi.mock('next/dynamic', () => ({
  default: () => () => null,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

// Stub the Fullscreen API jsdom doesn't implement.
beforeEach(() => {
  state.isTvActive = false;
  state.isPlaying = true;
  state.togglePlayPauseMock = vi.fn();
  state.setIsPlayingMock = vi.fn();
  state.fullscreenPlayerProps = null;
  state.primeAudioMock = vi.fn();
  state.requestFullscreenMock = vi.fn().mockResolvedValue(undefined);
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
