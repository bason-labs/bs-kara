import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { QueueItem } from '@/lib/youtube/types';
import { DndQueueList } from './DndQueueList';

function item(over: Partial<QueueItem> = {}): QueueItem {
  return {
    id: over.id ?? 'v',
    queueId: over.queueId ?? 'q',
    title: over.title ?? 'Track',
    channel: over.channel ?? 'Channel',
    thumbnail: over.thumbnail ?? '',
    duration: over.duration ?? '',
    ...over,
  };
}

describe('DndQueueList remove confirmation', () => {
  it('does not call onRemove when the trash button is clicked — opens confirm dialog instead', async () => {
    const onRemove = vi.fn();
    const user = userEvent.setup();
    render(
      <DndQueueList
        items={[item({ queueId: 'q1' })]}
        onReorder={() => {}}
        onRemove={onRemove}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'queue.removeAriaLabel' }));

    expect(onRemove).not.toHaveBeenCalled();
    expect(screen.getByText('queue.removeConfirm.title')).toBeInTheDocument();
    expect(screen.getByText('queue.removeConfirm.message')).toBeInTheDocument();
  });

  it('calls onRemove with the queueId only after the user confirms', async () => {
    const onRemove = vi.fn();
    const user = userEvent.setup();
    render(
      <DndQueueList
        items={[item({ queueId: 'q1' })]}
        onReorder={() => {}}
        onRemove={onRemove}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'queue.removeAriaLabel' }));
    await user.click(
      screen.getByRole('button', { name: 'queue.removeConfirm.confirm' }),
    );

    expect(onRemove).toHaveBeenCalledWith('q1');
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it('does not call onRemove when the user cancels the confirm dialog', async () => {
    const onRemove = vi.fn();
    const user = userEvent.setup();
    render(
      <DndQueueList
        items={[item({ queueId: 'q1' })]}
        onReorder={() => {}}
        onRemove={onRemove}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'queue.removeAriaLabel' }));
    // Cancel button label is also used as the backdrop's aria-label, so pick the
    // last one (the inline cancel button rendered inside the dialog body).
    const cancelButtons = screen.getAllByRole('button', {
      name: 'queue.removeConfirm.cancel',
    });
    await user.click(cancelButtons[cancelButtons.length - 1]);

    expect(onRemove).not.toHaveBeenCalled();
  });
});
