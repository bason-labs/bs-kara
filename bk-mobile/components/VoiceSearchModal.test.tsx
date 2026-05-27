import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { VoiceSearchModal } from './VoiceSearchModal';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        'voice.hint': 'Hát to lên hoặc đọc tên bài hát',
        'voice.recognizing': 'Đang nhận dạng giọng nói...',
      };
      return map[key] ?? key;
    },
  }),
}));

jest.mock('expo-linear-gradient', () => ({
  LinearGradient: ({ children }: { children: React.ReactNode }) => children,
}));

describe('VoiceSearchModal', () => {
  it('shows hint text when no transcript', () => {
    const { getByText } = render(
      <VoiceSearchModal visible={true} interimTranscript="" onClose={jest.fn()} />
    );
    expect(getByText('Hát to lên hoặc đọc tên bài hát')).toBeTruthy();
  });

  it('shows recognizing text when transcript is active', () => {
    const { getByText } = render(
      <VoiceSearchModal visible={true} interimTranscript="bolero trữ tình" onClose={jest.fn()} />
    );
    expect(getByText('Đang nhận dạng giọng nói...')).toBeTruthy();
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
    expect(queryByText('Hát to lên hoặc đọc tên bài hát')).toBeNull();
  });

  it('renders suggestion chips when provided and no transcript', () => {
    const { getByText } = render(
      <VoiceSearchModal visible={true} interimTranscript="" onClose={jest.fn()}
        suggestions={['Đắp mộ cuộc tình', 'Lạc trôi']} />
    );
    expect(getByText('"Đắp mộ cuộc tình"')).toBeTruthy();
    expect(getByText('"Lạc trôi"')).toBeTruthy();
  });

  it('hides suggestion chips when transcript is active', () => {
    const { queryByText } = render(
      <VoiceSearchModal visible={true} interimTranscript="đang nói" onClose={jest.fn()}
        suggestions={['Đắp mộ cuộc tình']} />
    );
    expect(queryByText('"Đắp mộ cuộc tình"')).toBeNull();
  });
});
