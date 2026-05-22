import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AddedToast } from './AddedToast';

const baseSong = {
  id: 'vid123',
  title: 'Hello',
  channel: 'Adele',
  thumbnail: 'https://example.com/x.jpg',
  duration: '3:45',
  queueId: 'q-abc',
  queuePos: 2,
};

describe('AddedToast', () => {
  it('renders song title and queue position when song is set', () => {
    render(
      <AddedToast song={baseSong} onUndo={() => {}} onViewQueue={() => {}} />,
    );
    expect(screen.getByText('Hello')).toBeInTheDocument();
    // i18n mock returns key with {{pos}} replaced → "toast.queuePosition" with pos=2
    expect(screen.getByText('toast.queuePosition')).toBeInTheDocument();
  });

  it('renders nothing visible when song is null', () => {
    const { container } = render(
      <AddedToast song={null} onUndo={() => {}} onViewQueue={() => {}} />,
    );
    expect(container.querySelector('img')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('calls onUndo with the song queueId when undo button clicked', async () => {
    const user = userEvent.setup();
    const onUndo = vi.fn();
    render(
      <AddedToast song={baseSong} onUndo={onUndo} onViewQueue={() => {}} />,
    );
    await user.click(screen.getByRole('button', { name: /toast\.undo/i }));
    expect(onUndo).toHaveBeenCalledTimes(1);
    expect(onUndo).toHaveBeenCalledWith('q-abc');
  });

  it('calls onViewQueue when the view button is clicked and does not call onUndo', async () => {
    const user = userEvent.setup();
    const onViewQueue = vi.fn();
    const onUndo = vi.fn();
    render(
      <AddedToast song={baseSong} onUndo={onUndo} onViewQueue={onViewQueue} />,
    );
    await user.click(screen.getByRole('button', { name: /toast\.viewQueue/i }));
    expect(onViewQueue).toHaveBeenCalledTimes(1);
    expect(onUndo).not.toHaveBeenCalled();
  });
});
