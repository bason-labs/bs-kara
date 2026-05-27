import { act, render, renderHook, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider, useTheme } from './ThemeProvider';

beforeEach(() => {
  document.documentElement.removeAttribute('data-theme');
  document.documentElement.style.colorScheme = '';
  // Default matchMedia stub: prefers light. Specific tests override.
  vi.spyOn(window, 'matchMedia').mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
});

afterEach(() => vi.restoreAllMocks());

describe('ThemeProvider + useTheme', () => {
  it('throws if useTheme is called outside the provider', () => {
    // Suppress the React error log so the test output stays readable.
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => renderHook(() => useTheme())).toThrow(
      'useTheme must be used within a ThemeProvider',
    );
  });

  it('defaults to system preference when nothing is stored', async () => {
    const { result } = renderHook(() => useTheme(), {
      wrapper: ({ children }) => <ThemeProvider>{children}</ThemeProvider>,
    });
    expect(result.current.preference).toBe('system');
    // microtask sets data-theme
    await Promise.resolve();
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('reads stored preference from localStorage', async () => {
    localStorage.setItem('karaoke_theme', 'dark');
    const { result } = renderHook(() => useTheme(), {
      wrapper: ({ children }) => <ThemeProvider>{children}</ThemeProvider>,
    });
    expect(result.current.preference).toBe('dark');
    expect(result.current.resolved).toBe('dark');
    await Promise.resolve();
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('setPreference writes to localStorage and notifies subscribers', async () => {
    const { result } = renderHook(() => useTheme(), {
      wrapper: ({ children }) => <ThemeProvider>{children}</ThemeProvider>,
    });
    act(() => result.current.setPreference('light'));
    expect(localStorage.getItem('karaoke_theme')).toBe('light');
    expect(result.current.preference).toBe('light');
  });

  it('exposes children of ThemeProvider unchanged', () => {
    render(
      <ThemeProvider>
        <span>kids</span>
      </ThemeProvider>,
    );
    expect(screen.getByText('kids')).toBeInTheDocument();
  });
});
