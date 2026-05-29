import React from 'react';
import { render } from '@testing-library/react-native';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import { QueueItemRow } from './QueueItemRow';

const item = {
  queueId: 'q1',
  id: 'v1',
  title: 'Test Song',
  channel: 'Ch',
  thumbnail: 'https://img',
  duration: '3:00',
  requesterName: 'Bason',
};

const base = {
  item,
  onRemove: jest.fn(),
  drag: jest.fn(),
  isHost: false,
  guestCanRemove: false,
};

describe('QueueItemRow', () => {
  it('shows channel name', () => {
    const { getByText } = render(<QueueItemRow {...base} />);
    expect(getByText('Ch')).toBeTruthy();
  });

  it('shows PlayNow button only for host', () => {
    const { queryByTestId, rerender } = render(<QueueItemRow {...base} isHost={false} />);
    expect(queryByTestId('play-now-button')).toBeNull();
    rerender(<QueueItemRow {...base} isHost={true} onPlayNow={jest.fn()} />);
    expect(queryByTestId('play-now-button')).toBeTruthy();
  });

  it('shows remove button for host', () => {
    const { getByTestId } = render(<QueueItemRow {...base} isHost={true} />);
    expect(getByTestId('remove-button')).toBeTruthy();
  });

  it('shows remove button for guest when guestCanRemove is true', () => {
    const { getByTestId } = render(<QueueItemRow {...base} isHost={false} guestCanRemove={true} />);
    expect(getByTestId('remove-button')).toBeTruthy();
  });

  it('hides remove button for guest when guestCanRemove is false', () => {
    const { queryByTestId } = render(<QueueItemRow {...base} isHost={false} guestCanRemove={false} />);
    expect(queryByTestId('remove-button')).toBeNull();
  });
});
