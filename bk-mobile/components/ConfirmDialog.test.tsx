import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

import { ConfirmDialog } from './ConfirmDialog';

const base = {
  open: true,
  title: 'Phát ngay?',
  message: 'Bài đang phát sẽ bị bỏ qua.',
  confirmLabel: 'Phát ngay',
  cancelLabel: 'Huỷ',
  onConfirm: jest.fn(),
  onCancel: jest.fn(),
};

describe('ConfirmDialog', () => {
  it('renders nothing when open is false', () => {
    const { queryByText } = render(<ConfirmDialog {...base} open={false} />);
    expect(queryByText('Phát ngay')).toBeNull();
    expect(queryByText('Huỷ')).toBeNull();
  });

  it('calls onConfirm when confirm button pressed', () => {
    const onConfirm = jest.fn();
    const { getByText } = render(<ConfirmDialog {...base} onConfirm={onConfirm} />);
    fireEvent.press(getByText('Phát ngay'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel when cancel button pressed', () => {
    const onCancel = jest.fn();
    const { getByText } = render(<ConfirmDialog {...base} onCancel={onCancel} />);
    fireEvent.press(getByText('Huỷ'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
