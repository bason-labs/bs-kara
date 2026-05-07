import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { RandomFilters } from '@/lib/youtube/types';

const previewVoiceMock = vi.fn();
const cancelMock = vi.fn();

vi.mock('@/hooks/useAIVoice', () => ({
  useAIVoice: () => ({
    previewVoice: previewVoiceMock,
    cancel: cancelMock,
    speak: vi.fn(),
    voicesReady: true,
  }),
  primeAudio: vi.fn(),
  DEFAULT_MC_VOICE: 'vi-VN-Neural2-A',
}));

import { ThemeProvider } from '@/components/ThemeProvider';
import { SettingsSheet } from './SettingsSheet';

const baseFilters: RandomFilters = { type: 'all', tone: 'all', genre: 'all' };

function renderSheet(over: Partial<React.ComponentProps<typeof SettingsSheet>> = {}) {
  const props = {
    open: true,
    onClose: vi.fn(),
    roomCode: '1234',
    autoRandomEnabled: false,
    filters: baseFilters,
    onAutoRandomToggle: vi.fn(),
    onFiltersChange: vi.fn(),
    dragDropEnabled: true,
    onDragDropToggle: vi.fn(),
    requesterPromptEnabled: true,
    onRequesterPromptToggle: vi.fn(),
    mcEnabled: true,
    onMCToggle: vi.fn(),
    mcVoice: 'vi-VN-Neural2-A',
    onMcVoiceChange: vi.fn(),
    aiScoringEnabled: false,
    onAiScoringToggle: vi.fn(),
    ...over,
  };
  render(
    <ThemeProvider>
      <SettingsSheet {...props} />
    </ThemeProvider>,
  );
  return props;
}

describe('SettingsSheet', () => {
  it('Escape closes the sheet', async () => {
    const user = userEvent.setup();
    const props = renderSheet();
    await user.keyboard('{Escape}');
    expect(props.onClose).toHaveBeenCalled();
  });

  it('toggling auto-random fires onAutoRandomToggle with the new state', async () => {
    const user = userEvent.setup();
    const props = renderSheet({ autoRandomEnabled: false });
    await user.click(
      screen.getByRole('button', { name: 'autoRandom.toggleAriaOff' }),
    );
    expect(props.onAutoRandomToggle).toHaveBeenCalledWith(true);
  });

  it('selecting type=duet resets tone to all in onFiltersChange', async () => {
    const user = userEvent.setup();
    const props = renderSheet({
      autoRandomEnabled: true,
      filters: { ...baseFilters, tone: 'female' },
    });
    await user.click(screen.getByRole('radio', { name: 'autoRandom.type.duet' }));
    expect(props.onFiltersChange).toHaveBeenCalledWith({
      type: 'duet',
      tone: 'all',
    });
  });

  it('selecting a non-duet type does NOT reset tone', async () => {
    const user = userEvent.setup();
    const props = renderSheet({
      autoRandomEnabled: true,
      filters: { ...baseFilters, tone: 'female' },
    });
    await user.click(screen.getByRole('radio', { name: 'autoRandom.type.solo' }));
    expect(props.onFiltersChange).toHaveBeenCalledWith({ type: 'solo' });
  });

  it('voice picker selection writes the new voice and triggers a preview', async () => {
    const user = userEvent.setup();
    const props = renderSheet({ mcEnabled: true });
    await user.click(
      screen.getByRole('radio', { name: 'settings.mcVoiceOptions.wavenetB' }),
    );
    expect(props.onMcVoiceChange).toHaveBeenCalledWith('vi-VN-Wavenet-B');
    expect(previewVoiceMock).toHaveBeenCalledWith(
      'vi-VN-Wavenet-B',
      expect.any(String),
    );
  });

  it('renders the room code', () => {
    renderSheet({ roomCode: '9999' });
    expect(screen.getByText('9999')).toBeInTheDocument();
  });
});
