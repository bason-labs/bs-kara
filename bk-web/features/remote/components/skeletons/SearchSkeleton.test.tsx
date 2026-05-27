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

  it('applies animate-shimmer to all placeholder elements (4 search-bar + 2 hot-hits header + 5 per row × 6 rows = 36)', () => {
    const { container } = render(<SearchSkeleton />);
    // SkeletonRow uses animate-shimmer (not animate-pulse) on its 5 placeholder divs:
    // thumb(1) + text-line-1(1) + text-line-2(1) + text-line-3(1) + circle(1) = 5 per row
    // Search-bar slot: search icon + input placeholder + filter trigger + mic = 4
    // Hot-hits header: emoji square + heading text = 2
    expect(container.querySelectorAll('.animate-shimmer').length).toBe(36);
  });

  it('renders a hot-hits header placeholder block above the rows', () => {
    const { container } = render(<SearchSkeleton />);
    const headerBlock = container.querySelector('.gap-2.px-1.pb-1');
    expect(headerBlock).toBeInTheDocument();
    expect(headerBlock!.querySelectorAll('.animate-shimmer').length).toBe(2);
  });

  it('renders a search-bar placeholder mirroring SearchPanel chrome', () => {
    const { container } = render(<SearchSkeleton />);
    // Pill: h-[52px] px-4 rounded-full — same shape the real SearchPanel uses.
    const pill = container.querySelector('.rounded-full.h-\\[52px\\]');
    expect(pill).toBeInTheDocument();
    // Three shimmers inside the pill (icon + input + filter), one mic outside.
    expect(pill!.querySelectorAll('.animate-shimmer').length).toBe(3);
  });
});
