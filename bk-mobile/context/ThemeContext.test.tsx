import React from 'react';
import { render, act } from '@testing-library/react-native';
import { Text } from 'react-native';
import * as RN from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ThemeProvider, useTheme } from './ThemeContext';
import type { Theme } from './ThemeContext';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
jest.mock('nativewind', () => ({
  useColorScheme: () => ({ setColorScheme: jest.fn() }),
}));

function ResolvedDisplay() {
  const { resolvedTheme } = useTheme();
  return <Text testID="resolved">{resolvedTheme}</Text>;
}
function PrefDisplay() {
  const { preference } = useTheme();
  return <Text testID="pref">{preference}</Text>;
}

describe('ThemeContext', () => {
  let useColorSchemeSpy: jest.SpyInstance;

  beforeEach(async () => {
    await AsyncStorage.clear();
    useColorSchemeSpy = jest.spyOn(RN, 'useColorScheme').mockReturnValue('dark');
  });

  afterEach(() => {
    useColorSchemeSpy.mockRestore();
    jest.clearAllMocks();
  });

  it('defaults to system preference', () => {
    const { getByTestId } = render(
      <ThemeProvider><PrefDisplay /></ThemeProvider>
    );
    expect(getByTestId('pref').props.children).toBe('system');
  });

  it('resolvedTheme is dark when preference is dark, regardless of OS', async () => {
    useColorSchemeSpy.mockReturnValue('light');
    let setter!: (p: Theme) => void;
    function Grabber() {
      const ctx = useTheme();
      setter = ctx.setPreference;
      return <Text testID="resolved">{ctx.resolvedTheme}</Text>;
    }
    const { getByTestId } = render(<ThemeProvider><Grabber /></ThemeProvider>);
    await act(async () => { setter('dark'); });
    expect(getByTestId('resolved').props.children).toBe('dark');
  });

  it('resolvedTheme is light when preference is light, regardless of OS', async () => {
    useColorSchemeSpy.mockReturnValue('dark');
    let setter!: (p: Theme) => void;
    function Grabber() {
      const ctx = useTheme();
      setter = ctx.setPreference;
      return <Text testID="resolved">{ctx.resolvedTheme}</Text>;
    }
    const { getByTestId } = render(<ThemeProvider><Grabber /></ThemeProvider>);
    await act(async () => { setter('light'); });
    expect(getByTestId('resolved').props.children).toBe('light');
  });

  it('resolvedTheme follows OS when preference is system', () => {
    useColorSchemeSpy.mockReturnValue('light');
    const { getByTestId } = render(
      <ThemeProvider><ResolvedDisplay /></ThemeProvider>
    );
    expect(getByTestId('resolved').props.children).toBe('light');
  });

  it('resolvedTheme is never "system" — always light or dark', () => {
    const { getByTestId } = render(
      <ThemeProvider><ResolvedDisplay /></ThemeProvider>
    );
    expect(['light', 'dark']).toContain(getByTestId('resolved').props.children);
  });

  it('restores preference from AsyncStorage on mount', async () => {
    await AsyncStorage.setItem('karaoke_theme', 'light');
    const { getByTestId } = render(
      <ThemeProvider><PrefDisplay /></ThemeProvider>
    );
    await act(async () => {});
    expect(getByTestId('pref').props.children).toBe('light');
  });

  it('setPreference persists to AsyncStorage', async () => {
    let setter!: (p: Theme) => void;
    function Grabber() {
      const ctx = useTheme();
      setter = ctx.setPreference;
      return null;
    }
    render(<ThemeProvider><Grabber /></ThemeProvider>);
    await act(async () => { setter('system'); });
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('karaoke_theme', 'system');
  });
});
