import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { SettingsSkeleton } from './SettingsSkeleton';

describe('SettingsSkeleton', () => {
  it('renders without crashing', () => {
    const { container } = render(<SettingsSkeleton />);
    expect(container.firstChild).not.toBeNull();
  });

  it('renders 3 section blocks', () => {
    const { container } = render(<SettingsSkeleton />);
    // Each section has a header bar + toggle rows inside a space-y-2 wrapper
    const sections = container.querySelectorAll('.space-y-2');
    expect(sections.length).toBe(3);
  });

  it('applies animate-pulse to all placeholder elements', () => {
    const { container } = render(<SettingsSkeleton />);
    // 3 section headers (1 each) + 7 rows total × 3 per row (title + hint + toggle) = 3 + 21 = 24
    expect(container.querySelectorAll('.animate-pulse').length).toBe(24);
  });
});
