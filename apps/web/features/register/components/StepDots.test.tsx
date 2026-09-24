import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { StepDots } from './StepDots';

// Regression: the register flow has 3 internal steps (phone, otp, name) but
// the name step is optional and shown only for brand-new phone numbers. The
// progress indicator must show only 2 dots (phone → otp), not 3.
describe('StepDots', () => {
  it('renders exactly 2 dots, not one per internal step', () => {
    render(<StepDots current="phone" />);
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });

  it('marks the first dot active on the phone step', () => {
    render(<StepDots current="phone" />);
    const dots = screen.getAllByRole('listitem');
    expect(dots[0]).toHaveAttribute('data-active', 'true');
    expect(dots[1]).toHaveAttribute('data-active', 'false');
  });

  it('marks the second dot active and the first complete on the otp step', () => {
    render(<StepDots current="otp" />);
    const dots = screen.getAllByRole('listitem');
    expect(dots[0]).toHaveAttribute('data-complete', 'true');
    expect(dots[1]).toHaveAttribute('data-active', 'true');
  });

  it('keeps both dots complete (still 2 dots) on the optional name step', () => {
    render(<StepDots current="name" />);
    const dots = screen.getAllByRole('listitem');
    expect(dots).toHaveLength(2);
    expect(dots[0]).toHaveAttribute('data-complete', 'true');
    expect(dots[1]).toHaveAttribute('data-complete', 'true');
    expect(dots.some((d) => d.getAttribute('data-active') === 'true')).toBe(false);
  });
});
