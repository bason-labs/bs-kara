import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { SearchSkeleton } from './SearchSkeleton';

describe('SearchSkeleton', () => {
  it('has data-testid="search-skeleton" on the root element', () => {
    render(<SearchSkeleton />);
    expect(screen.getByTestId('search-skeleton')).toBeInTheDocument();
  });

  it('renders 6 SkeletonRow placeholders', () => {
    const { container } = render(<SearchSkeleton />);
    // SkeletonRow uses the grid grid-cols-[110px_1fr_44px] template
    const rows = container.querySelectorAll('.grid');
    expect(rows.length).toBe(6);
  });

  it('applies animate-shimmer to placeholder elements inside each row (5 per row × 6 rows + 2 header = 32)', () => {
    const { container } = render(<SearchSkeleton />);
    // SkeletonRow uses animate-shimmer (not animate-pulse) on its 5 placeholder divs:
    // thumb(1) + text-line-1(1) + text-line-2(1) + text-line-3(1) + circle(1) = 5 per row
    // plus 2 header shimmer blocks (emoji square + heading text) = 32 total
    expect(container.querySelectorAll('.animate-shimmer').length).toBe(32);
  });

  it('renders a header placeholder block above the rows', () => {
    const { container } = render(<SearchSkeleton />);
    const headerBlock = container.querySelector('.gap-2.px-1.pb-1');
    expect(headerBlock).toBeInTheDocument();
    // should contain exactly 2 shimmer boxes (emoji square + heading text)
    expect(headerBlock!.querySelectorAll('.animate-shimmer').length).toBe(2);
  });
});
