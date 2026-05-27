import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

vi.mock('./sections/ThemeSection', () => ({
  ThemeSection: () => <div>settings.sections.appearance</div>,
}));
vi.mock('./sections/AIMcSection', () => ({
  AIMcSection: () => <div>settings.sections.aiMc</div>,
}));

import { SettingsPanel } from './SettingsPanel';

const baseProps = {
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
  panelOpen: true,
};

describe('SettingsPanel', () => {
  // Same gating that SettingsSheet enforces: non-hosts see only the rooms
  // they can actually act on (appearance + room code).
  it('shows only theme and room sections when isHost is false', () => {
    render(<SettingsPanel {...baseProps} isHost={false} />);
    expect(screen.getByText('settings.sections.appearance')).toBeInTheDocument();
    expect(screen.getByText('settings.sections.room')).toBeInTheDocument();
    expect(screen.queryByText('settings.sections.queue')).not.toBeInTheDocument();
    expect(screen.queryByText('settings.sections.autoRandom')).not.toBeInTheDocument();
    expect(screen.queryByText('settings.sections.aiMc')).not.toBeInTheDocument();
  });

  it('shows all sections when isHost is true', () => {
    render(<SettingsPanel {...baseProps} isHost={true} />);
    expect(screen.getByText('settings.sections.queue')).toBeInTheDocument();
    expect(screen.getByText('settings.sections.autoRandom')).toBeInTheDocument();
    expect(screen.getByText('settings.sections.aiMc')).toBeInTheDocument();
    expect(screen.getByText('settings.sections.appearance')).toBeInTheDocument();
    expect(screen.getByText('settings.sections.room')).toBeInTheDocument();
  });

  // The bug the refactor fixes: as a tab panel (not a sheet) the content
  // must not carry overlay chrome — no fixed-position wrapper, no
  // backdrop, no role="dialog". A future engineer reading this can tell
  // at a glance that SettingsPanel is meant to live inline.
  it('renders as inline content, not as a modal dialog', () => {
    const { container } = render(<SettingsPanel {...baseProps} isHost={true} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(container.querySelector('[class*="fixed"]')).toBeNull();
    expect(container.querySelector('[class*="backdrop-blur"]')).toBeNull();
  });

  it('renders a leave-room button when onLeave is provided', () => {
    render(<SettingsPanel {...baseProps} isHost={false} onLeave={vi.fn()} />);
    expect(
      screen.getByRole('button', { name: 'header.leaveButton' }),
    ).toBeInTheDocument();
  });

  it('omits the leave-room button when onLeave is not provided', () => {
    render(<SettingsPanel {...baseProps} isHost={false} />);
    expect(
      screen.queryByRole('button', { name: 'header.leaveButton' }),
    ).not.toBeInTheDocument();
  });
});
