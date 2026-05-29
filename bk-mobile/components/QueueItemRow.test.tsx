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
};

describe('QueueItemRow', () => {
  it('shows channel name', () => {
    const { getByText } = render(<QueueItemRow {...base} />);
    expect(getByText('Ch')).toBeTruthy();
  });

  // The trash icon was previously gated on `isHost || guestCanRemove`; that
  // gate is removed — every user can delete their own queue, with the
  // confirm dialog providing the misclick safety net.
  it('always renders the remove button', () => {
    const { getByTestId } = render(<QueueItemRow {...base} />);
    expect(getByTestId('remove-button')).toBeTruthy();
  });
});
