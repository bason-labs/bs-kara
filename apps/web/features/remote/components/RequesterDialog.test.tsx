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

  describe('save singer name', () => {
    it('checkbox is checked by default on first open', () => {
      render(
        <RequesterDialog
          open
          initialName=""
          mode="add"
          onConfirm={() => {}}
          onCancel={() => {}}
        />,
      );
      const checkbox = screen.getByRole('checkbox', { name: 'requester.saveNameLabel' });
      expect(checkbox).toBeChecked();
    });

    it('prefills the input from the saved name when add mode opens', () => {
      localStorage.setItem('savedSingerName', 'Charlie');
      render(
        <RequesterDialog
          open
          initialName=""
          mode="add"
          onConfirm={() => {}}
          onCancel={() => {}}
        />,
      );
      expect(screen.getByPlaceholderText('requester.placeholder')).toHaveValue('Charlie');
    });

    it('uses the explicit initialName over the saved name (edit mode)', () => {
      localStorage.setItem('savedSingerName', 'Charlie');
      render(
        <RequesterDialog
          open
          initialName="Bob"
          mode="edit"
          onConfirm={() => {}}
          onCancel={() => {}}
        />,
      );
      expect(screen.getByPlaceholderText('requester.placeholder')).toHaveValue('Bob');
    });

    it('saves the name to localStorage on confirm when checkbox is checked', async () => {
      const user = userEvent.setup();
      render(
        <RequesterDialog
          open
          initialName=""
          mode="add"
          onConfirm={() => {}}
          onCancel={() => {}}
        />,
      );
      await user.type(screen.getByPlaceholderText('requester.placeholder'), 'Dana');
      await user.click(screen.getByRole('button', { name: 'requester.confirmButton' }));
      expect(localStorage.getItem('savedSingerName')).toBe('Dana');
      expect(localStorage.getItem('saveSingerNameEnabled')).toBe('true');
    });

    it('clears the saved name on confirm when checkbox is unchecked', async () => {
      const user = userEvent.setup();
      localStorage.setItem('savedSingerName', 'Eve');
      render(
        <RequesterDialog
          open
          initialName=""
          mode="add"
          onConfirm={() => {}}
          onCancel={() => {}}
        />,
      );
      await user.click(screen.getByRole('checkbox', { name: 'requester.saveNameLabel' }));
      await user.click(screen.getByRole('button', { name: 'requester.confirmButton' }));
      expect(localStorage.getItem('savedSingerName')).toBeNull();
      expect(localStorage.getItem('saveSingerNameEnabled')).toBe('false');
    });

    it('persists an unchecked checkbox so the next open starts unchecked', () => {
      localStorage.setItem('saveSingerNameEnabled', 'false');
      render(
        <RequesterDialog
          open
          initialName=""
          mode="add"
          onConfirm={() => {}}
          onCancel={() => {}}
        />,
      );
      expect(
        screen.getByRole('checkbox', { name: 'requester.saveNameLabel' }),
      ).not.toBeChecked();
    });

    it('does not overwrite the saved name with empty when confirming with no input', async () => {
      const user = userEvent.setup();
      localStorage.setItem('savedSingerName', 'Frank');
      render(
        <RequesterDialog
          open
          // Force the input to start empty even though a saved name exists.
          initialName=" "
          mode="add"
          onConfirm={() => {}}
          onCancel={() => {}}
        />,
      );
      const input = screen.getByPlaceholderText('requester.placeholder');
      await user.clear(input);
      await user.click(screen.getByRole('button', { name: 'requester.confirmButton' }));
      expect(localStorage.getItem('savedSingerName')).toBe('Frank');
    });

    it('toggling the checkbox does not clear the saved name on its own', async () => {
      const user = userEvent.setup();
      localStorage.setItem('savedSingerName', 'Grace');
      render(
        <RequesterDialog
          open
          initialName=""
          mode="add"
          onConfirm={() => {}}
          onCancel={() => {}}
        />,
      );
      await user.click(screen.getByRole('checkbox', { name: 'requester.saveNameLabel' }));
      expect(localStorage.getItem('savedSingerName')).toBe('Grace');
    });

    it('Skip leaves the save preference and saved name untouched', async () => {
      const user = userEvent.setup();
      localStorage.setItem('savedSingerName', 'Henry');
      localStorage.setItem('saveSingerNameEnabled', 'true');
      render(
        <RequesterDialog
          open
          initialName=""
          mode="add"
          onConfirm={() => {}}
          onCancel={() => {}}
        />,
      );
      await user.click(screen.getByRole('button', { name: 'requester.skipButton' }));
      expect(localStorage.getItem('savedSingerName')).toBe('Henry');
      expect(localStorage.getItem('saveSingerNameEnabled')).toBe('true');
    });
  });
});
