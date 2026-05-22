import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { VoiceSearchModal } from './VoiceSearchModal';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        'voice.listening': 'Đang nghe...',
        'voice.hint': 'Nói tên bài hát bạn muốn tìm',
        'voice.recognizing': 'Chữ hiển thị trong khi nhận dạng giọng nói',
      };
      return map[key] ?? key;
    },
  }),
}));

describe('VoiceSearchModal', () => {
  it('renders the listening label when visible', () => {
    const { getByText } = render(
      <VoiceSearchModal visible={true} interimTranscript="" onClose={jest.fn()} />
    );
    expect(getByText('Đang nghe...')).toBeTruthy();
  });

  it('renders interim transcript when provided', () => {
    const { getByText } = render(
      <VoiceSearchModal visible={true} interimTranscript="bolero trữ tình" onClose={jest.fn()} />
    );
    expect(getByText('bolero trữ tình')).toBeTruthy();
  });

  it('calls onClose when X button is pressed', () => {
    const onClose = jest.fn();
    const { getByTestId } = render(
      <VoiceSearchModal visible={true} interimTranscript="" onClose={onClose} />
    );
    fireEvent.press(getByTestId('voice-close-button'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not render content when not visible', () => {
    const { queryByText } = render(
      <VoiceSearchModal visible={false} interimTranscript="" onClose={jest.fn()} />
    );
    expect(queryByText('Đang nghe...')).toBeNull();
  });
});
