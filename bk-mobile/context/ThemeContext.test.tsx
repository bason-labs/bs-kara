import React from 'react';
import { render, act } from '@testing-library/react-native';
import { Text } from 'react-native';
import { ThemeProvider, useTheme } from './ThemeContext';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest')
);
jest.mock('nativewind', () => ({
  useColorScheme: () => ({ setColorScheme: jest.fn() }),
}));

function ThemeDisplay() {
  const { theme } = useTheme();
  return <Text testID="theme">{theme}</Text>;
}

describe('ThemeContext', () => {
  it('defaults to dark theme', () => {
    const { getByTestId } = render(
      <ThemeProvider><ThemeDisplay /></ThemeProvider>
    );
    expect(getByTestId('theme').props.children).toBe('dark');
  });

  it('toggles between dark and light', async () => {
    let toggle: () => void;
    function Grabber() {
      const ctx = useTheme();
      toggle = ctx.toggleTheme;
      return <Text testID="theme">{ctx.theme}</Text>;
    }
    const { getByTestId } = render(
      <ThemeProvider><Grabber /></ThemeProvider>
    );
    expect(getByTestId('theme').props.children).toBe('dark');
    await act(async () => { toggle(); });
    expect(getByTestId('theme').props.children).toBe('light');
  });
});
