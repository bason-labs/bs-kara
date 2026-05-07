import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { AIMcSection } from '@/features/remote/components/SettingsSheet/sections/AIMcSection';

// VoicePicker pulls in audio APIs we don't need to exercise here — stub
// to a marker so the section renders without ceremony.
vi.mock('@/features/remote/components/SettingsSheet/VoicePicker', () => ({
  VoicePicker: () => <div data-testid="voice-picker-stub" />,
}));

const baseProps = {
  enabled: true,
  onToggle: vi.fn(),
  mcVoice: 'vi-VN-Neural2-A',
  onMcVoiceChange: vi.fn(),
  aiScoringEnabled: false,
  onAiScoringToggle: vi.fn(),
  panelOpen: true,
};

describe('AIMcSection — AI scoring toggle row', () => {
  it('renders both the AI MC toggle and the AI scoring toggle', () => {
    render(<AIMcSection {...baseProps} />);
    // Two ToggleRow buttons inside the section — labelled by their
    // translation keys via the global pass-through i18n mock.
    expect(screen.getByRole('button', { name: /settings\.aiMcLabel/ })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /scoring\.toggleLabel/ }),
    ).toBeInTheDocument();
  });

  it('reflects the current aiScoringEnabled value via aria-pressed', () => {
    const { rerender } = render(
      <AIMcSection {...baseProps} aiScoringEnabled={false} />,
    );
    expect(
      screen.getByRole('button', { name: /scoring\.toggleLabel/ }),
    ).toHaveAttribute('aria-pressed', 'false');

    rerender(<AIMcSection {...baseProps} aiScoringEnabled={true} />);
    expect(
      screen.getByRole('button', { name: /scoring\.toggleLabel/ }),
    ).toHaveAttribute('aria-pressed', 'true');
  });

  it('clicks fire onAiScoringToggle with the inverted value', async () => {
    const onAiScoringToggle = vi.fn();
    const user = userEvent.setup();

    const { rerender } = render(
      <AIMcSection
        {...baseProps}
        aiScoringEnabled={false}
        onAiScoringToggle={onAiScoringToggle}
      />,
    );
    await user.click(
      screen.getByRole('button', { name: /scoring\.toggleLabel/ }),
    );
    expect(onAiScoringToggle).toHaveBeenLastCalledWith(true);

    rerender(
      <AIMcSection
        {...baseProps}
        aiScoringEnabled={true}
        onAiScoringToggle={onAiScoringToggle}
      />,
    );
    await user.click(
      screen.getByRole('button', { name: /scoring\.toggleLabel/ }),
    );
    expect(onAiScoringToggle).toHaveBeenLastCalledWith(false);
  });
});
