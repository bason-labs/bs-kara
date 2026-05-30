import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { SettingsSheet } from './SettingsSheet';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'settings.title': 'Cài đặt',
        'settings.sections.autoRandom': 'Tự động phát',
        'settings.sections.queue': 'Hàng chờ',
        'settings.sections.aiMc': 'MC',
        'settings.sections.room': 'Phòng',
        'settings.dragDropLabel': 'Kéo thả sắp xếp',
        'settings.dragDropHint': 'Cho phép kéo thả để thay đổi thứ tự bài hát trong hàng chờ.',
        'settings.requesterPromptLabel': 'Hỏi tên ca sĩ',
        'settings.requesterPromptHint': 'Khi tắt, bài hát sẽ được thêm ngay vào hàng chờ mà không hỏi tên người hát.',
        'settings.guestCanRemoveLabel': 'Cho phép khách xóa bài',
        'settings.guestCanRemoveHint': 'Khách tham gia có thể xóa bài trong hàng chờ.',
        'settings.aiMcLabel': 'Bật/Tắt MC',
        'settings.aiMcHint': 'Trước mỗi bài, MC sẽ đọc lời giới thiệu ngắn bằng tiếng Việt qua loa TV.',
        'settings.mcVoiceLabel': 'Giọng MC',
        'settings.roomCodeLabel': 'Mã phòng hiện tại',
        'autoRandom.toggleLabel': 'Tự động phát ngẫu nhiên',
        'autoRandom.onBadge': 'Đang bật',
        'autoRandom.offBadge': 'Đang tắt',
        'autoRandom.description': 'Khi hàng chờ trống, hệ thống sẽ tự chọn bài mới.',
        'autoRandom.genreLabel': 'Thể loại',
        'autoRandom.typeLabel': 'Kiểu hát',
        'autoRandom.toneLabel': 'Tông giọng',
        'autoRandom.genre.all': 'Tất cả',
        'autoRandom.type.all': 'Tất cả',
        'autoRandom.tone.all': 'Tất cả',
        'scoring.toggleLabel': 'AI chấm điểm',
        'scoring.toggleHelp': 'Hiển thị điểm cho mỗi bài hát ở 8 giây cuối.',
        'settings.mcVoiceOptions.neural2A': 'Nữ trung',
        'settings.mcVoiceOptions.wavenetC': 'Nữ trầm',
        'settings.mcVoiceOptions.neural2D': 'Nam trầm',
        'settings.mcVoiceOptions.wavenetB': 'Nam trung',
      };
      return translations[key] ?? key;
    },
  }),
}));

const mockRoom = {
  roomCode: '1234',
  roomData: {
    isAutoRandomMode: false,
    dragDropEnabled: true,
    requesterPromptEnabled: true,
    isMCEnabled: true,
    mcVoice: 'vi-VN-Neural2-A',
    guestCanRemove: false,
    aiScoringEnabled: false,
    randomFilters: { type: 'all', tone: 'all', genre: 'all' },
    hostUid: null,
  },
  setAutoRandomMode: jest.fn(),
  setDragDropEnabled: jest.fn(),
  setRequesterPromptEnabled: jest.fn(),
  setMCEnabled: jest.fn(),
  setMcVoice: jest.fn(),
  setGuestCanRemove: jest.fn(),
  setAiScoringEnabled: jest.fn(),
  setRandomFilters: jest.fn(),
};

jest.mock('@/context/RoomContext', () => ({
  useRoomContext: () => mockRoom,
}));

jest.mock('@/context/ThemeContext', () => ({
  useTheme: () => ({ preference: 'dark', resolvedTheme: 'dark', setPreference: jest.fn() }),
}));

describe('SettingsSheet', () => {
  it('renders the settings title when open', () => {
    const { getByText } = render(
      <SettingsSheet isOpen={true} onClose={jest.fn()} />
    );
    expect(getByText('Cài đặt')).toBeTruthy();
  });

  it('renders nothing when closed', () => {
    const { queryByText } = render(
      <SettingsSheet isOpen={false} onClose={jest.fn()} />
    );
    expect(queryByText('Cài đặt')).toBeNull();
  });

  it('calls setDragDropEnabled when toggle is pressed', () => {
    const { getByTestId } = render(
      <SettingsSheet isOpen={true} onClose={jest.fn()} />
    );
    fireEvent(getByTestId('toggle-drag-drop'), 'valueChange', false);
    expect(mockRoom.setDragDropEnabled).toHaveBeenCalledWith(false);
  });
});
