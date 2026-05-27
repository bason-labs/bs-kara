import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { PlayerSkeleton } from './PlayerSkeleton';

describe('PlayerSkeleton', () => {
  it('has data-testid="player-skeleton" on the root element', () => {
    render(<PlayerSkeleton />);
    expect(screen.getByTestId('player-skeleton')).toBeInTheDocument();
  });

  it('applies animate-shimmer to all placeholder elements (thumb + label + title + channel + 5 emoji + 3 controls = 12)', () => {
    const { container } = render(<PlayerSkeleton />);
    expect(container.querySelectorAll('.animate-shimmer').length).toBe(12);
  });

  it('contains an aspect-video thumbnail placeholder matching the hero NowPlayingCard', () => {
    const { container } = render(<PlayerSkeleton />);
    expect(container.querySelector('.aspect-video')).not.toBeNull();
  });

  it('renders exactly 7 w-11 h-11 rounded-full circles (5 emoji + 2 side controls)', () => {
    const { container } = render(<PlayerSkeleton />);
    // Each SkeletonBox with these classes also carries animate-shimmer; query by the size+shape combo
    const circles = container.querySelectorAll('.w-11.h-11.rounded-full');
    expect(circles.length).toBe(7);
  });

  it('renders exactly 1 w-16 h-16 rounded-full circle (the central play button)', () => {
    const { container } = render(<PlayerSkeleton />);
    const playCircles = container.querySelectorAll('.w-16.h-16.rounded-full');
    expect(playCircles.length).toBe(1);
  });
});
