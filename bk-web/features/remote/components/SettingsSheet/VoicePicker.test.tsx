import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { VoicePicker } from './VoicePicker';

const previewVoice = vi.fn(() => Promise.resolve());
const cancel = vi.fn();

vi.mock('@/hooks/useAIVoice', () => ({
  useAIVoice: () => ({ previewVoice, cancel, voicesReady: true, speak: vi.fn() }),
}));

beforeEach(() => {
  previewVoice.mockClear();
  cancel.mockClear();
});

describe('VoicePicker', () => {
  it('cancels in-flight preview when panelOpen flips to false', () => {
    // Regression: SettingsSheet stays mounted across open/close (it slides
    // off-screen instead of unmounting), so an unmount-only cleanup left
    // the voice preview audible after the sheet closed. Watching panelOpen
    // is what catches the close edge.
    const { rerender } = render(
      <VoicePicker
        value="vi-VN-Neural2-A"
        disabled={false}
        onChange={() => {}}
        panelOpen
      />,
    );
    cancel.mockClear();

    rerender(
      <VoicePicker
        value="vi-VN-Neural2-A"
        disabled={false}
        onChange={() => {}}
        panelOpen={false}
      />,
    );

    expect(cancel).toHaveBeenCalled();
  });

  it('plays a preview when a voice card is clicked while open', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { getAllByRole } = render(
      <VoicePicker
        value="vi-VN-Neural2-A"
        disabled={false}
        onChange={onChange}
        panelOpen
      />,
    );
    const radios = getAllByRole('radio');
    await user.click(radios[1]);
    expect(onChange).toHaveBeenCalledWith('vi-VN-Wavenet-C');
    expect(previewVoice).toHaveBeenCalledWith(
      'vi-VN-Wavenet-C',
      expect.any(String),
    );
  });
});
