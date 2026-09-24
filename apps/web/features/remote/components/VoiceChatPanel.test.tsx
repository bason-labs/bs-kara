import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { VoiceChatPanel } from './VoiceChatPanel';
import { VoiceConversation } from '@/features/voice/conversation';

vi.mock('@/features/voice/audio', () => ({ captureVoice: vi.fn(), speakVoice: vi.fn(), primeVoiceAudio: vi.fn() }));
const video = { id: 'birthday', title: 'Happy Birthday', channel: 'Karaoke', thumbnail: '', duration: '' };

describe('VoiceChatPanel', () => {
  it('renders returned results, lets a user select, and preserves the transcript while inactive', async () => {
    let id = 0;
    const conversation = new VoiceConversation({
      createSession: async () => ({ sessionId: 's', token: 't' }),
      capture: async () => new Blob(), transcribe: async () => '', speak: async () => {}, prime: () => {}, id: () => `id${++id}`,
      turn: async (_, input) => input.selection ? { reply: 'Added to queue', receipt: { status: 'queued', video } } : { reply: 'Which version?', results: { searchId: 's1', videos: [video] } },
    });
    const props = { conversation, active: true, modeSwitch: <span>Modes</span> };
    const { rerender } = render(<VoiceChatPanel {...props} />);
    await act(() => conversation.submitText('Happy Birthday karaoke'));
    expect(screen.getByText('Which version?')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: /Happy Birthday/ }));
    await waitFor(() => expect(screen.getByText('Added to queue')).toBeVisible());
    rerender(<VoiceChatPanel {...props} active={false} />);
    rerender(<VoiceChatPanel {...props} />);
    expect(screen.getByText('Added to queue')).toBeVisible();
    expect(screen.getByRole('button', { name: /Happy Birthday/ })).toBeDisabled();
  });
});
