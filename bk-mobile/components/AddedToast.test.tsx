import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';

jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ bottom: 0 }) }));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        'toast.addedToQueue': 'Đã thêm vào hàng chờ',
      };
      return map[key] ?? key;
    },
  }),
}));

import { AddedToast } from './AddedToast';

describe('AddedToast', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks(); });

  it('renders the success text', () => {
    const { getByText } = render(<AddedToast onDismiss={jest.fn()} />);
    expect(getByText('Đã thêm vào hàng chờ')).toBeTruthy();
  });

  it('calls onDismiss after the auto-dismiss timer', () => {
    const onDismiss = jest.fn();
    render(<AddedToast onDismiss={onDismiss} />);
    act(() => { jest.advanceTimersByTime(1800); });
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('calls onDismiss when tapped', () => {
    const onDismiss = jest.fn();
    const { getByTestId } = render(<AddedToast onDismiss={onDismiss} />);
    fireEvent.press(getByTestId('toast-card'));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
