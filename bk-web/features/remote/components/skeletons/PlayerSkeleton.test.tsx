import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { PlayerSkeleton } from './PlayerSkeleton';

describe('PlayerSkeleton', () => {
  it('has data-testid="player-skeleton" on the root element', () => {
    render(<PlayerSkeleton />);
    expect(screen.getByTestId('player-skeleton')).toBeInTheDocument();
  });

  it('applies animate-shimmer to all placeholder elements (thumb + label + title + channel = 4)', () => {
    const { container } = render(<PlayerSkeleton />);
    expect(container.querySelectorAll('.animate-shimmer').length).toBe(4);
  });

  it('contains an aspect-video thumbnail placeholder matching the hero NowPlayingCard', () => {
    const { container } = render(<PlayerSkeleton />);
    expect(container.querySelector('.aspect-video')).not.toBeNull();
  });
});
