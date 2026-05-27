import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { PlayerSkeleton } from './PlayerSkeleton';

describe('PlayerSkeleton', () => {
  it('renders without crashing', () => {
    const { container } = render(<PlayerSkeleton />);
    expect(container.firstChild).not.toBeNull();
  });

  it('applies animate-pulse to all placeholder elements (thumb + 2 text + 3 controls = 6)', () => {
    const { container } = render(<PlayerSkeleton />);
    expect(container.querySelectorAll('.animate-pulse').length).toBe(6);
  });
});
