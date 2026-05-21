import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { QueueItemRow } from './QueueItemRow';

const mockItem = {
  id: 'abc',
  queueId: 'q1',
  title: 'Song Title',
  channel: 'Channel',
  thumbnail: 'https://img.youtube.com/vi/abc/mqdefault.jpg',
  duration: '3:30',
};

describe('QueueItemRow', () => {
  it('renders the song title', () => {
    const { getByText } = render(
      <QueueItemRow item={mockItem} onRemove={jest.fn()} drag={jest.fn()} />
    );
    expect(getByText('Song Title')).toBeTruthy();
  });

  it('calls onRemove when remove button is pressed', () => {
    const onRemove = jest.fn();
    const { getByTestId } = render(
      <QueueItemRow item={mockItem} onRemove={onRemove} drag={jest.fn()} />
    );
    fireEvent.press(getByTestId('remove-button'));
    expect(onRemove).toHaveBeenCalledTimes(1);
  });
});
