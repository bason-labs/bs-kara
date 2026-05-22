import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { SongResultItem } from './SongResultItem';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        'search.addedToQueueButton': 'Đã thêm',
      };
      return map[key] ?? key;
    },
  }),
}));

const mockVideo = {
  id: 'abc123',
  title: 'Test Song Karaoke',
  channel: 'Karaoke Channel',
  thumbnail: 'https://img.youtube.com/vi/abc123/mqdefault.jpg',
  duration: '3:45',
};

describe('SongResultItem', () => {
  it('renders the song title', () => {
    const { getByText } = render(
      <SongResultItem video={mockVideo} onAdd={jest.fn()} added={false} />
    );
    expect(getByText('Test Song Karaoke')).toBeTruthy();
  });

  it('calls onAdd when add button is pressed', () => {
    const onAdd = jest.fn();
    const { getByTestId } = render(
      <SongResultItem video={mockVideo} onAdd={onAdd} added={false} />
    );
    fireEvent.press(getByTestId('add-button'));
    expect(onAdd).toHaveBeenCalledTimes(1);
  });

  it('shows added state when added=true', () => {
    const { getByText } = render(
      <SongResultItem video={mockVideo} onAdd={jest.fn()} added={true} />
    );
    expect(getByText('Đã thêm')).toBeTruthy();
  });
});
