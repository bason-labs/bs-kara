import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { SettingsSkeleton } from './SettingsSkeleton';

describe('SettingsSkeleton', () => {
  it('has data-testid="settings-skeleton" on the root element', () => {
    render(<SettingsSkeleton />);
    expect(screen.getByTestId('settings-skeleton')).toBeInTheDocument();
  });

  it('renders 3 section blocks', () => {
    const { container } = render(<SettingsSkeleton />);
    // Each section has a header bar + toggle rows inside a space-y-2 wrapper
    const sections = container.querySelectorAll('.space-y-2');
    expect(sections.length).toBe(3);
  });

  it('applies animate-shimmer to all placeholder elements', () => {
    const { container } = render(<SettingsSkeleton />);
    // 3 section headers × 2 shimmers (icon + label) = 6
    // 7 rows total × 3 per row (title + hint + toggle) = 21
    // Total = 27
    expect(container.querySelectorAll('.animate-shimmer').length).toBe(27);
  });

  it('each section header has an icon shimmer and a label shimmer in a flex row', () => {
    const { container } = render(<SettingsSkeleton />);
    const headerRows = container.querySelectorAll('.flex.items-center.gap-2');
    expect(headerRows.length).toBeGreaterThanOrEqual(1);
    // Each header row should have exactly two children (icon shimmer + label shimmer)
    headerRows.forEach((row) => {
      expect(row.children.length).toBe(2);
    });
  });
});
