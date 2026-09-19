import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { QueueSection } from './QueueSection';

describe('QueueSection', () => {
  it('lets the host enable voice chat mode', () => {
    const onVoiceChatToggle = vi.fn();
    render(
      <QueueSection
        dragDropEnabled
        onDragDropToggle={vi.fn()}
        requesterPromptEnabled
        onRequesterPromptToggle={vi.fn()}
        guestCanRemove={false}
        onGuestCanRemoveToggle={vi.fn()}
        voiceChatEnabled={false}
        onVoiceChatToggle={onVoiceChatToggle}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /settings\.voiceChatLabel/ }));
    expect(onVoiceChatToggle).toHaveBeenCalledWith(true);
  });
});
