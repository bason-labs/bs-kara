import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

vi.mock('./sections/ThemeSection', () => ({
  ThemeSection: () => <div>settings.sections.appearance</div>,
}));
vi.mock('./sections/AIMcSection', () => ({
  AIMcSection: () => <div>settings.sections.aiMc</div>,
}));

import { SettingsSheet } from './SettingsSheet';

const baseProps = {
  open: true,
  onClose: vi.fn(),
  roomCode: '1234',
  autoRandomEnabled: false,
  filters: { type: 'all' as const, tone: 'all' as const, genre: 'all' as const },
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
  guestCanRemove: false,
  onGuestCanRemoveToggle: vi.fn(),
  isHost: false,
};

describe('SettingsSheet — scroll container placement', () => {
  it('does not scroll via a nested h-full element inside the modal card', () => {
    // Regression: the desktop centering wrapper is a row-flex with align-items:center,
    // so the card height is auto. A child div with h-full + overflow-y-auto resolves
    // h-full to auto and the scroll never triggers. The scroll must be on the
    // flex-1 body wrapper (a column-flex item) which does get a definite height.
    const { container } = render(<SettingsSheet {...baseProps} />);
    const nestedScroller = container.querySelector(
      '.overflow-y-auto.h-full, [class*="overflow-y-auto"][class*="h-full"]',
    );
    expect(nestedScroller).toBeNull();
  });
});

describe('SettingsSheet — role gating', () => {
  it('shows only theme and room sections when isHost is false', () => {
    render(<SettingsSheet {...baseProps} isHost={false} />);
    expect(screen.getByText('settings.sections.appearance')).toBeInTheDocument();
    expect(screen.getByText('settings.sections.room')).toBeInTheDocument();
    expect(screen.queryByText('settings.sections.queue')).not.toBeInTheDocument();
    expect(screen.queryByText('settings.sections.autoRandom')).not.toBeInTheDocument();
    expect(screen.queryByText('settings.sections.aiMc')).not.toBeInTheDocument();
  });

  it('shows all sections when isHost is true', () => {
    render(<SettingsSheet {...baseProps} isHost={true} />);
    expect(screen.getByText('settings.sections.queue')).toBeInTheDocument();
    expect(screen.getByText('settings.sections.autoRandom')).toBeInTheDocument();
    expect(screen.getByText('settings.sections.aiMc')).toBeInTheDocument();
    expect(screen.getByText('settings.sections.appearance')).toBeInTheDocument();
    expect(screen.getByText('settings.sections.room')).toBeInTheDocument();
  });
});
