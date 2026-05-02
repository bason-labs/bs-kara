import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { RequesterDialog } from './RequesterDialog';

describe('RequesterDialog', () => {
  it('focuses the input after opening', async () => {
    render(
      <RequesterDialog
        open
        initialName=""
        mode="add"
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    );
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByPlaceholderText('requester.placeholder')),
    );
  });

  it('submits the trimmed name on Confirm', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <RequesterDialog
        open
        initialName="  Alice  "
        mode="add"
        onConfirm={onConfirm}
        onCancel={() => {}}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'requester.confirmButton' }));
    expect(onConfirm).toHaveBeenCalledWith('Alice');
  });

  it('Skip in add mode returns null', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <RequesterDialog
        open
        initialName=""
        mode="add"
        onConfirm={onConfirm}
        onCancel={() => {}}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'requester.skipButton' }));
    expect(onConfirm).toHaveBeenCalledWith(null);
  });

  it('Clear in edit mode returns null', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <RequesterDialog
        open
        initialName="Bob"
        mode="edit"
        onConfirm={onConfirm}
        onCancel={() => {}}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'requester.clearButton' }));
    expect(onConfirm).toHaveBeenCalledWith(null);
  });

  it('Escape fires onCancel', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(
      <RequesterDialog
        open
        initialName=""
        mode="add"
        onConfirm={() => {}}
        onCancel={onCancel}
      />,
    );
    await user.keyboard('{Escape}');
    expect(onCancel).toHaveBeenCalled();
  });
});
