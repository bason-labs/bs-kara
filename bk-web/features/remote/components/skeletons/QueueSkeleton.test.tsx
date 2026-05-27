import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { QueueSkeleton } from './QueueSkeleton';

describe('QueueSkeleton', () => {
  it('renders 5 rows', () => {
    const { container } = render(<QueueSkeleton />);
    const rows = container.querySelectorAll('.grid.grid-cols-\\[110px_1fr_44px\\]');
    expect(rows.length).toBe(5);
  });

  it('applies animate-shimmer to all placeholder elements (4 per row × 5 rows = 20)', () => {
    const { container } = render(<QueueSkeleton />);
    expect(container.querySelectorAll('.animate-shimmer').length).toBe(20);
  });
});
