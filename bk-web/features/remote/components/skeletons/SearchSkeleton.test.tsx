import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { SearchSkeleton } from './SearchSkeleton';

describe('SearchSkeleton', () => {
  it('renders 6 SkeletonRow placeholders', () => {
    const { container } = render(<SearchSkeleton />);
    // SkeletonRow uses the grid grid-cols-[110px_1fr_44px] template
    const rows = container.querySelectorAll('.grid');
    expect(rows.length).toBe(6);
  });

  it('applies animate-shimmer to placeholder elements inside each row (5 per row × 6 rows = 30)', () => {
    const { container } = render(<SearchSkeleton />);
    // SkeletonRow uses animate-shimmer (not animate-pulse) on its 5 placeholder divs:
    // thumb(1) + text-line-1(1) + text-line-2(1) + text-line-3(1) + circle(1) = 5 per row
    expect(container.querySelectorAll('.animate-shimmer').length).toBe(30);
  });
});
