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

describe('ClientQueue', () => {
  it('shows the empty state when there are no items', () => {
    render(<ClientQueue items={[]} onReorder={() => {}} onRemove={() => {}} />);
    expect(screen.getByText('queue.emptyMessage')).toBeInTheDocument();
  });

  it('renders one row per item with title and remove button', () => {
    render(
      <ClientQueue
        items={[item({ queueId: 'q1', title: 'A' }), item({ queueId: 'q2', title: 'B' })]}
        onReorder={() => {}}
        onRemove={() => {}}
        isHost={true}
      />,
    );
    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.getByText('B')).toBeInTheDocument();
    expect(
      screen.getAllByRole('button', { name: 'queue.removeAriaLabel' }),
    ).toHaveLength(2);
  });

  it('clicking remove calls onRemove with the queueId', async () => {
    const onRemove = vi.fn();
    const user = userEvent.setup();
    render(
      <ClientQueue
        items={[item({ queueId: 'q1' })]}
        onReorder={() => {}}
        onRemove={onRemove}
        isHost={true}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'queue.removeAriaLabel' }));
    expect(onRemove).toHaveBeenCalledWith('q1');
  });

  it('shows an "add singer" pill when onEditRequester is provided and no requester yet', () => {
    render(
      <ClientQueue
        items={[item()]}
        onReorder={() => {}}
        onRemove={() => {}}
        onEditRequester={() => {}}
      />,
    );
    expect(screen.getByRole('button', { name: 'requester.addAriaLabel' })).toBeInTheDocument();
  });

  it('shows an "edit singer" pill when a requesterName is set', () => {
    render(
      <ClientQueue
        items={[item({ requesterName: 'Alice' })]}
        onReorder={() => {}}
        onRemove={() => {}}
        onEditRequester={() => {}}
      />,
    );
    expect(screen.getByRole('button', { name: 'requester.editAriaLabel' })).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
  });

  it('renders the static (non-DnD) list when dragDropEnabled=false', () => {
    render(
      <ClientQueue
        items={[item({ queueId: 'q1' })]}
        dragDropEnabled={false}
        onReorder={() => {}}
        onRemove={() => {}}
      />,
    );
    // Static path doesn't add the Reorder song aria label.
    expect(screen.queryByLabelText('Reorder song')).toBeNull();
  });
});

describe('ClientQueue — role gating', () => {
  it('shows remove button when isHost is true regardless of guestCanRemove', () => {
    render(
      <ClientQueue
        items={[item()]}
        onReorder={() => {}}
        onRemove={() => {}}
        isHost={true}
        guestCanRemove={false}
      />,
    );
    expect(screen.getByRole('button', { name: 'queue.removeAriaLabel' })).toBeInTheDocument();
  });

  it('shows remove button when guestCanRemove is true', () => {
    render(
      <ClientQueue
        items={[item()]}
        onReorder={() => {}}
        onRemove={() => {}}
        isHost={false}
        guestCanRemove={true}
      />,
    );
    expect(screen.getByRole('button', { name: 'queue.removeAriaLabel' })).toBeInTheDocument();
  });

  it('hides remove button when isHost is false and guestCanRemove is false', () => {
    render(
      <ClientQueue
        items={[item()]}
        onReorder={() => {}}
        onRemove={() => {}}
        isHost={false}
        guestCanRemove={false}
      />,
    );
    expect(screen.queryByRole('button', { name: 'queue.removeAriaLabel' })).not.toBeInTheDocument();
  });
});
