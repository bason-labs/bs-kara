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
    // Each row is a direct child of the scroll area with flex layout
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

  it('applies animate-shimmer to all placeholder elements (2 header + 7 per row × 5 rows = 37)', () => {
    const { container } = render(<QueueSkeleton />);
    // Header: 2 (title bar + count blob)
    // Each row: 1 drag + 1 index + 1 thumb + 2 title lines + 1 requester pill + 1 trash = 7
    // Total: 2 + (7 × 5) = 37
    expect(container.querySelectorAll('.animate-shimmer').length).toBe(37);
  });
});
