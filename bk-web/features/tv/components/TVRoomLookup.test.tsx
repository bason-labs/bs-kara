/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TVRoomLookup } from './TVRoomLookup';

describe('TVRoomLookup', () => {
  it('renders input and submit button', () => {
    render(
      <TVRoomLookup
        resolveRoomCode={vi.fn()}
        onActivate={vi.fn()}
      />
    );
    expect(screen.getByRole('textbox')).toBeInTheDocument();
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('calls onActivate with resolved code on successful submit', async () => {
    const resolveRoomCode = vi.fn().mockResolvedValue('5678');
    const onActivate = vi.fn().mockResolvedValue(undefined);
    render(
      <TVRoomLookup resolveRoomCode={resolveRoomCode} onActivate={onActivate} />
    );
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '0912345678' } });
    fireEvent.click(screen.getByRole('button'));
    await waitFor(() => expect(onActivate).toHaveBeenCalledWith('5678'));
  });

  it('shows error message when resolveRoomCode returns null', async () => {
    const resolveRoomCode = vi.fn().mockResolvedValue(null);
    render(
      <TVRoomLookup resolveRoomCode={resolveRoomCode} onActivate={vi.fn()} />
    );
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '0000' } });
    fireEvent.click(screen.getByRole('button'));
    // Test i18n returns translation keys; assert the not-found key renders.
    await waitFor(() =>
      expect(screen.getByText('tv.lookup.notFound')).toBeInTheDocument()
    );
  });

  it('shows error message when resolveRoomCode throws', async () => {
    const resolveRoomCode = vi.fn().mockRejectedValue(new Error('network'));
    render(
      <TVRoomLookup resolveRoomCode={resolveRoomCode} onActivate={vi.fn()} />
    );
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '5678' } });
    fireEvent.click(screen.getByRole('button'));
    // Test i18n returns translation keys; assert the error key renders.
    await waitFor(() =>
      expect(screen.getByText('tv.lookup.error')).toBeInTheDocument()
    );
  });

  it('disables button while loading', async () => {
    let resolvePromise!: (v: string | null) => void;
    const resolveRoomCode = vi.fn(
      () => new Promise<string | null>((res) => { resolvePromise = res; })
    );
    render(
      <TVRoomLookup resolveRoomCode={resolveRoomCode} onActivate={vi.fn()} />
    );
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '5678' } });
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByRole('button')).toBeDisabled();
    resolvePromise(null);
    await waitFor(() => expect(screen.getByRole('button')).not.toBeDisabled());
  });
});
