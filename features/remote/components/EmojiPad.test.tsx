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

  it('applies the bounce class to the inner span after a click', async () => {
    const user = userEvent.setup();
    render(<EmojiPad onSendEmoji={() => {}} />);
    const target = REACTIONS[0];

    const before = screen.getByTestId(`emoji-bounce-${target}`);
    expect(before.classList.contains('emoji-tap-bounce')).toBe(true);

    await user.click(screen.getAllByRole('button')[0]);

    const after = screen.getByTestId(`emoji-bounce-${target}`);
    expect(after.classList.contains('emoji-tap-bounce')).toBe(true);
  });

  it('remounts the inner span on every same-emoji click (key change)', async () => {
    const user = userEvent.setup();
    render(<EmojiPad onSendEmoji={() => {}} />);
    const target = REACTIONS[0];
    const button = screen.getAllByRole('button')[0];

    await user.click(button);
    const firstNode = screen.getByTestId(`emoji-bounce-${target}`);

    await user.click(button);
    const secondNode = screen.getByTestId(`emoji-bounce-${target}`);

    // Different DOM node reference proves React unmounted/remounted via key
    // change — which is exactly what restarts the CSS animation.
    expect(secondNode).not.toBe(firstNode);
  });

  it('does not remount other emojis when one emoji is clicked', async () => {
    const user = userEvent.setup();
    render(<EmojiPad onSendEmoji={() => {}} />);
    const tapped = REACTIONS[0];
    const untouched = REACTIONS[1];

    const untouchedBefore = screen.getByTestId(`emoji-bounce-${untouched}`);

    await user.click(screen.getAllByRole('button')[0]);

    const tappedAfter = screen.getByTestId(`emoji-bounce-${tapped}`);
    const untouchedAfter = screen.getByTestId(`emoji-bounce-${untouched}`);

    expect(tappedAfter).toBeDefined();
    // The untouched emoji's span node identity must be preserved — only the
    // tapped emoji's key changed, so React must reconcile the rest in place.
    expect(untouchedAfter).toBe(untouchedBefore);
  });
});
