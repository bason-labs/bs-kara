import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { ThemeProvider } from './ThemeProvider';
import { ThemeToggle } from './ThemeToggle';

function withProvider(ui: React.ReactNode) {
  return <ThemeProvider>{ui}</ThemeProvider>;
}

describe('ThemeToggle', () => {
  it('renders three radio options', () => {
    render(withProvider(<ThemeToggle />));
    const options = screen.getAllByRole('radio');
    expect(options).toHaveLength(3);
  });

  it('marks the current preference as aria-checked', () => {
    localStorage.setItem('karaoke_theme', 'dark');
    render(withProvider(<ThemeToggle />));
    const dark = screen.getByRole('radio', { name: 'theme.dark' });
    expect(dark).toHaveAttribute('aria-checked', 'true');
  });

  it('clicking a radio updates the active selection', async () => {
    const user = userEvent.setup();
    render(withProvider(<ThemeToggle />));
    await user.click(screen.getByRole('radio', { name: 'theme.light' }));
    expect(screen.getByRole('radio', { name: 'theme.light' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });
});
