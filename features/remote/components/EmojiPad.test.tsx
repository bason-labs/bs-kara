import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { REACTIONS } from '@/lib/reactions';
import { EmojiPad } from './EmojiPad';

describe('EmojiPad', () => {
  it('renders one button per reaction', () => {
    render(<EmojiPad onSendEmoji={() => {}} />);
    expect(screen.getAllByRole('button')).toHaveLength(REACTIONS.length);
  });

  it('forwards the clicked emoji into onSendEmoji', async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();
    render(<EmojiPad onSendEmoji={onSend} />);
    const buttons = screen.getAllByRole('button');
    await user.click(buttons[0]);
    expect(onSend).toHaveBeenCalledWith(REACTIONS[0]);
  });
});
