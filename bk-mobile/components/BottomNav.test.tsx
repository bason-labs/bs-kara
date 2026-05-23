import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { SettingsContext } from '@/context/SettingsContext';

jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ bottom: 0 }) }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (_k: string, fallback?: string) => fallback ?? _k }) }));
jest.mock('./EQBars', () => ({ EQBars: () => null }));

import { BottomNav } from './BottomNav';

const base = { activeTab: 'search' as const, isPlaying: false, queueLength: 0, onTabChange: jest.fn() };

function renderWithSettings(openSettings: jest.Mock, props = base) {
  return render(
    <SettingsContext.Provider value={{ openSettings }}>
      <BottomNav {...props} />
    </SettingsContext.Provider>
  );
}

describe('BottomNav', () => {
  it('calls onTabChange with correct tab', () => {
    const onTabChange = jest.fn();
    const { getByTestId } = renderWithSettings(jest.fn(), { ...base, onTabChange });
    fireEvent.press(getByTestId('tab-queue'));
    expect(onTabChange).toHaveBeenCalledWith('queue');
  });

  it('calls openSettings from context when settings tab pressed', () => {
    const openSettings = jest.fn();
    const { getByTestId } = renderWithSettings(openSettings);
    fireEvent.press(getByTestId('tab-settings'));
    expect(openSettings).toHaveBeenCalledTimes(1);
  });

  it('shows queue badge when queueLength > 0', () => {
    const { getByTestId } = renderWithSettings(jest.fn(), { ...base, queueLength: 3 });
    expect(getByTestId('queue-badge')).toBeTruthy();
  });

  it('hides queue badge when queueLength === 0', () => {
    const { queryByTestId } = renderWithSettings(jest.fn());
    expect(queryByTestId('queue-badge')).toBeNull();
  });

  it('settings tab is never marked selected', () => {
    const { getByTestId } = renderWithSettings(jest.fn());
    expect(getByTestId('tab-settings').props.accessibilityState?.selected).toBeFalsy();
  });
});
