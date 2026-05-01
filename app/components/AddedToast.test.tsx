import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AddedToast } from './AddedToast';

describe('AddedToast', () => {
  it('renders the song title and the view-queue button when song is set', () => {
    render(
      <AddedToast
        song={{ title: 'Hello', thumbnail: 'https://example.com/x.jpg' }}
        onViewQueue={() => {}}
        onDismiss={() => {}}
      />,
    );
    expect(screen.getByText('Hello')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'toast.viewQueue' })).toBeInTheDocument();
  });

  it('renders nothing when song is null', () => {
    const { container } = render(
      <AddedToast song={null} onViewQueue={() => {}} onDismiss={() => {}} />,
    );
    expect(container.querySelector('img')).toBeNull();
  });

  it('clicking the body fires onDismiss', async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    render(
      <AddedToast
        song={{ title: 'Hello', thumbnail: '' }}
        onViewQueue={() => {}}
        onDismiss={onDismiss}
      />,
    );
    await user.click(screen.getByText('Hello'));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('clicking the view-queue button fires onViewQueue without onDismiss', async () => {
    const user = userEvent.setup();
    const onViewQueue = vi.fn();
    const onDismiss = vi.fn();
    render(
      <AddedToast
        song={{ title: 'X', thumbnail: '' }}
        onViewQueue={onViewQueue}
        onDismiss={onDismiss}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'toast.viewQueue' }));
    expect(onViewQueue).toHaveBeenCalledTimes(1);
    expect(onDismiss).not.toHaveBeenCalled();
  });
});
