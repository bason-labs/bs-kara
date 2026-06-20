// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Firebase must be mocked before any module that transitively imports it.
vi.mock('@/lib/firebase', () => ({ db: {}, auth: {} }));
vi.mock('firebase/database', () => ({
  ref: vi.fn(),
  onValue: vi.fn(),
  get: vi.fn(),
  set: vi.fn(),
  update: vi.fn(),
  off: vi.fn(),
}));
vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(),
  onAuthStateChanged: vi.fn((_auth: unknown, cb: (u: null) => void) => { cb(null); return () => {}; }),
}));

// Inert heavy child components — the home screen doesn't render any of them,
// but they are imported by RemoteClient so they must resolve without error.
vi.mock('@/features/remote/components/SearchPanel', () => ({ SearchPanel: () => null }));
vi.mock('@/features/remote/components/ClientQueue', () => ({ ClientQueue: () => null }));
vi.mock('@/features/remote/components/EmojiPad', () => ({ EmojiPad: () => null }));
vi.mock('@/components/EmojiLayer', () => ({ EmojiLayer: () => null }));
vi.mock('@/features/remote/components/NeonOrbs', () => ({ NeonOrbs: () => null }));
vi.mock('@/features/remote/components/ThemeToggle', () => ({ ThemeToggle: () => null }));
vi.mock('@/features/remote/components/AddedToast', () => ({ AddedToast: () => null }));
vi.mock('@/features/remote/components/RequesterDialog', () => ({ RequesterDialog: () => null }));
vi.mock('@/features/remote/components/JoinForm', () => ({ JoinForm: () => null }));
vi.mock('@/features/remote/components/NowPlayingCard', () => ({ NowPlayingCard: () => null }));
vi.mock('@/features/remote/components/FullscreenPlayer', () => ({ FullscreenPlayer: () => null }));
vi.mock('@/features/remote/components/RemoteControls', () => ({ RemoteControls: () => null }));
vi.mock('@/features/remote/components/SessionExpiredOverlay', () => ({ SessionExpiredOverlay: () => null }));
vi.mock('next/dynamic', () => ({ default: () => () => null }));
vi.mock('qrcode.react', () => ({ QRCodeSVG: () => null }));

// Hook mocks — all Firebase-free stubs
const submitJoinSpy = vi.fn();

// Configurable per-test via hostState
const hostState = vi.hoisted(() => ({
  loading: false as boolean,
  profile: {
    roomCode: '4489', normalizedPhone: '84912345678', suspended: false, createdAt: 1000,
  } as { roomCode: string; normalizedPhone: string; suspended: boolean; createdAt: number } | null,
}));

vi.mock('@/features/remote/hooks/useRoomGate', () => ({
  useRoomGate: () => ({
    rawRoomCode: null,
    roomCode: null,
    isCoarsePointer: false,
    joinError: null,
    isJoining: false,
    submitJoin: submitJoinSpy,
    handleLeave: vi.fn(),
  }),
}));

vi.mock('@/features/remote/hooks/useCurrentHost', () => ({
  useCurrentHost: () => ({
    user: hostState.profile ? { uid: 'host-uid-123', phoneNumber: '+84912345678' } : null,
    profile: hostState.profile,
    loading: hostState.loading,
  }),
}));

vi.mock('@/features/remote/hooks/useHostAuth', () => ({
  useHostAuth: () => ({ user: { uid: 'host-uid-123' }, isHost: true, loading: false }),
}));

vi.mock('@/features/remote/hooks/useInactivityTimeout', () => ({
  useInactivityTimeout: () => ({ timedOut: false, rejoinReason: null, resetActivity: vi.fn(), rejoin: vi.fn() }),
}));

vi.mock('@/features/remote/hooks/useRequesterDialog', () => ({
  useRequesterDialog: () => ({
    handleAddToQueue: vi.fn(), handleEditRequester: vi.fn(), handleRequesterConfirm: vi.fn(),
    closeRequesterDialog: vi.fn(), dialogOpen: false, dialogMode: 'add', dialogKey: 0,
    dialogInitialName: '', toastSong: null, dismissToast: vi.fn(),
  }),
}));

vi.mock('@/features/remote/hooks/useQueuedMap', () => ({ useQueuedMap: () => ({}) }));

vi.mock('@/features/remote/hooks/useFullscreenOwnership', () => ({
  useFullscreenOwnership: () => ({ deviceId: 'test', claim: vi.fn(), release: vi.fn() }),
}));

vi.mock('@bs-kara/shared/hooks', () => ({
  useRoom: () => ({
    roomData: {
      queue: [], currentPlaying: null, isPlaying: false, volume: 100, history: [],
      isAutoRandomMode: false, randomFilters: { type: 'all', tone: 'all', genre: 'all' },
      playedHistory: [], dragDropEnabled: true, requesterPromptEnabled: true,
      isMCEnabled: true, mcVoice: 'vi-VN-Neural2-A', lastAnnouncedSongId: null,
      aiScoringEnabled: false, lastScoredSongId: null, isTvActive: false,
      fullscreenOwner: null, lastEndedAt: null,
      hostUid: 'host-uid-123', guestCanRemove: false,
    },
    isLoading: false, roomExists: null,
    addSongToQueue: vi.fn(), updateRequesterName: vi.fn(), removeSong: vi.fn(),
    reorderQueue: vi.fn(), togglePlayPause: vi.fn(), setIsPlaying: vi.fn(),
    playNext: vi.fn(), playPrevious: vi.fn(), sendEmoji: vi.fn(),
    setAutoRandomMode: vi.fn(), setRandomFilters: vi.fn(), setDragDropEnabled: vi.fn(),
    setRequesterPromptEnabled: vi.fn(), setMCEnabled: vi.fn(), setAiScoringEnabled: vi.fn(),
    setMcVoice: vi.fn(), setGuestCanRemove: vi.fn(), tryClaimAnnouncementLock: vi.fn(),
    removeCurrentPlaying: vi.fn(), addToPlayedHistory: vi.fn(),
    setCurrentPlayingDirectly: vi.fn(), playSongNow: vi.fn(),
  }),
  useTransientNotice: () => ({ notice: null, show: vi.fn() }),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('@/hooks/useAutoRandom', () => ({ useAutoRandom: () => {} }));
vi.mock('@/hooks/useAIVoice', () => ({ primeAudio: vi.fn() }));

import RemoteClient from './RemoteClient';

beforeEach(() => {
  submitJoinSpy.mockClear();
  hostState.loading = false;
  hostState.profile = { roomCode: '4489', normalizedPhone: '84912345678', suspended: false, createdAt: 1000 };
});

// Regression: when the host clicked "Vào phòng của tôi" (Join my room), it
// called submitJoin() which hits /api/room-access. The API was previously
// blocking the request with guests_not_allowed — even though the caller IS
// the owner. Fix: host navigates directly to /?room=XXXX via a Link,
// bypassing the guest-access gate entirely.
describe('RemoteClient home screen — host navigation', () => {
  it('does not call submitJoin when the host clicks "Join my room"', async () => {
    const user = userEvent.setup();
    render(<RemoteClient />);

    // The host element should be an <a> link pointing directly to the room
    const hostLink = screen.getByText('auth.goToMyRoom');
    expect(hostLink.closest('a')).toHaveAttribute('href', '/?room=4489');

    // Clicking it must NOT call submitJoin (which goes through the guest-access API)
    await user.click(hostLink);
    expect(submitJoinSpy).not.toHaveBeenCalled();
  });

  // Regression: useCurrentHost starts loading=true while Firebase Auth resolves.
  // Before the fix, profile=null during loading caused the "Login/Register"
  // button to flash instead of waiting for the auth state to settle.
  it('shows the skeleton while host auth is loading, not the login/register button', () => {
    hostState.loading = true;
    hostState.profile = null;

    render(<RemoteClient />);

    expect(screen.queryByText('auth.goToMyRoom')).not.toBeInTheDocument();
    expect(screen.queryByText('auth.loginOrRegister')).not.toBeInTheDocument();
  });
});
