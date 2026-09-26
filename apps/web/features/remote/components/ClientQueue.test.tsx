import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { QueueItem } from '@bs-kara/shared';
import { ClientQueue } from './ClientQueue';

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

const noop = () => {};

describe('ClientQueue', () => {
  it('clicking remove calls onRemove with the queueId', async () => {
    const onRemove = vi.fn();
    render(<ClientQueue items={[item({ queueId: 'q1' })]} onReorder={noop} onRemove={onRemove} isHost />);
    await userEvent.click(screen.getByRole('button', { name: 'queue.removeAriaLabel' }));
    expect(onRemove).toHaveBeenCalledWith('q1');
  });

  it.each([
    { isHost: true, guestCanRemove: false, canRemove: true },
    { isHost: false, guestCanRemove: true, canRemove: true },
    { isHost: false, guestCanRemove: false, canRemove: false },
  ])(
    'isHost=$isHost, guestCanRemove=$guestCanRemove → remove button shown: $canRemove',
    ({ isHost, guestCanRemove, canRemove }) => {
      render(
        <ClientQueue
          items={[item()]}
          onReorder={noop}
          onRemove={noop}
          isHost={isHost}
          guestCanRemove={guestCanRemove}
        />,
      );
      const buttons = screen.queryAllByRole('button', { name: 'queue.removeAriaLabel' });
      expect(buttons).toHaveLength(canRemove ? 1 : 0);
    },
  );

  it.each([
    { requesterName: undefined, label: 'requester.addAriaLabel' },
    { requesterName: 'Alice', label: 'requester.editAriaLabel' },
  ])('requester pill uses $label when requesterName=$requesterName', ({ requesterName, label }) => {
    render(
      <ClientQueue items={[item({ requesterName })]} onReorder={noop} onRemove={noop} onEditRequester={noop} />,
    );
    expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
  });
});
