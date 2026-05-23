import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ bottom: 0 }) }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (_k: string, fallback?: string) => fallback ?? _k }) }));
jest.mock('./EQBars', () => ({ EQBars: () => null }));

import { BottomNav } from './BottomNav';

const base = { activeTab: 'search' as const, isPlaying: false, queueLength: 0, onTabChange: jest.fn(), onOpenSettings: jest.fn() };

describe('BottomNav', () => {
  it('calls onTabChange with correct tab', () => {
    const onTabChange = jest.fn();
    const { getByTestId } = render(<BottomNav {...base} onTabChange={onTabChange} />);
    fireEvent.press(getByTestId('tab-queue'));
    expect(onTabChange).toHaveBeenCalledWith('queue');
  });

  it('calls onOpenSettings when settings tab pressed', () => {
    const onOpenSettings = jest.fn();
    const { getByTestId } = render(<BottomNav {...base} onOpenSettings={onOpenSettings} />);
    fireEvent.press(getByTestId('tab-settings'));
    expect(onOpenSettings).toHaveBeenCalledTimes(1);
  });

  it('shows queue badge when queueLength > 0', () => {
    const { getByTestId } = render(<BottomNav {...base} queueLength={3} />);
    expect(getByTestId('queue-badge')).toBeTruthy();
  });

  it('hides queue badge when queueLength === 0', () => {
    const { queryByTestId } = render(<BottomNav {...base} queueLength={0} />);
    expect(queryByTestId('queue-badge')).toBeNull();
  });

  it('settings tab is never marked selected', () => {
    const { getByTestId } = render(<BottomNav {...base} activeTab="search" />);
    expect(getByTestId('tab-settings').props.accessibilityState?.selected).toBeFalsy();
  });
});
