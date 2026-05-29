import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { QueueSkeleton } from './QueueSkeleton';

describe('QueueSkeleton', () => {
  it('has data-testid="queue-skeleton" on the root element', () => {
    render(<QueueSkeleton />);
    expect(screen.getByTestId('queue-skeleton')).toBeInTheDocument();
  });

  it('renders 5 flex rows matching ClientQueue row shape', () => {
    const { container } = render(<QueueSkeleton />);
    const rows = container.querySelectorAll(
      '.flex.items-center.gap-3.p-3.rounded-xl.border.border-border.bg-surface',
    );
    expect(rows.length).toBe(5);
  });

  it('renders a sticky header placeholder above the scroll area', () => {
    const { container } = render(<QueueSkeleton />);
    const header = container.querySelector('.sticky.top-0.border-b');
    expect(header).not.toBeNull();
  });

  it('renders a desktop-only NowPlayingCard placeholder above the queue header', () => {
    const { container } = render(<QueueSkeleton />);
    const cardSlot = container.querySelector(
      '[data-testid="queue-skeleton-now-playing"]',
    );
    expect(cardSlot).not.toBeNull();
    expect(cardSlot!.className).toMatch(/hidden/);
    expect(cardSlot!.className).toMatch(/lg:block/);
    expect(cardSlot!.querySelectorAll('.animate-shimmer').length).toBe(5);
  });

  // Bottom strip wraps EmojiPad + RemoteControls in a single container so
  // bg-surface/85 + backdrop-blur-md cover both (mirrors RemoteClient.tsx
  // lines 658-672). The lg:block gate lives on this wrapper, not the inner
  // emoji/controls divs.
  it('renders a desktop-only bottom bar wrapper around the emoji + controls slots', () => {
    const { container } = render(<QueueSkeleton />);
    const wrapper = container.querySelector(
      '[data-testid="queue-skeleton-bottom-bar"]',
    );
    expect(wrapper).not.toBeNull();
    expect(wrapper!.className).toMatch(/hidden/);
    expect(wrapper!.className).toMatch(/lg:block/);
    expect(wrapper!.className).toMatch(/bg-surface\/85/);
    expect(wrapper!.className).toMatch(/backdrop-blur-md/);
    expect(wrapper!.className).toMatch(/border-t/);
    // Both inner slots are inside this wrapper
    expect(wrapper!.querySelector('[data-testid="queue-skeleton-emoji-pad"]'))
      .not.toBeNull();
    expect(wrapper!.querySelector('[data-testid="queue-skeleton-controls"]'))
      .not.toBeNull();
  });

  it('renders an EmojiPad placeholder with 5 reaction circles inside the bottom bar', () => {
    const { container } = render(<QueueSkeleton />);
    const emojiSlot = container.querySelector(
      '[data-testid="queue-skeleton-emoji-pad"]',
    );
    expect(emojiSlot).not.toBeNull();
    expect(emojiSlot!.querySelectorAll('.w-11.h-11.rounded-full').length).toBe(5);
  });

  it('renders a RemoteControls placeholder with 3 transport circles inside the bottom bar', () => {
    const { container } = render(<QueueSkeleton />);
    const controlsSlot = container.querySelector(
      '[data-testid="queue-skeleton-controls"]',
    );
    expect(controlsSlot).not.toBeNull();
    expect(controlsSlot!.querySelectorAll('.w-11.h-11.rounded-full').length).toBe(2);
    expect(controlsSlot!.querySelectorAll('.w-16.h-16.rounded-full').length).toBe(1);
  });

  it('applies animate-shimmer to all placeholder elements (50 total)', () => {
    const { container } = render(<QueueSkeleton />);
    // Header: 2 (title bar + count blob)
    // Queue rows: 7 × 5 = 35
    // NowPlayingCard slot: 5
    // EmojiPad slot: 5
    // RemoteControls slot: 3
    // Total: 2 + 35 + 5 + 5 + 3 = 50
    expect(container.querySelectorAll('.animate-shimmer').length).toBe(50);
  });
});
