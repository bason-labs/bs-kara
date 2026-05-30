// bk-mobile/components/SettingsSheet.tsx
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRoomContext } from '@/context/RoomContext';
import { useTheme } from '@/context/ThemeContext';
import { DarkColors, LightColors } from '@/constants/colors';
import {
  AutoRandomSection,
  QueueSection,
  AIMcSection,
  ThemeSection,
  RoomSection,
} from '@/features/settings';
import type { Genre, SingerType, Tone } from '@bs-kara/shared';

interface SettingsSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsSheet({ isOpen, onClose }: SettingsSheetProps) {
  const { t } = useTranslation();
  const { resolvedTheme } = useTheme();
  const c = resolvedTheme === 'dark' ? DarkColors : LightColors;
  const {
    roomData,
    roomCode,
    setAutoRandomMode,
    setRandomFilters,
    setDragDropEnabled,
    setRequesterPromptEnabled,
    setMCEnabled,
    setAiScoringEnabled,
    setMcVoice,
    setGuestCanRemove,
  } = useRoomContext();

  if (!isOpen) return null;

  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 100 }}>
      <TouchableOpacity
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }}
        activeOpacity={1}
        onPress={onClose}
      />
      <View
        style={{
          backgroundColor: c.surface,
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          paddingHorizontal: 20,
          paddingTop: 24,
          paddingBottom: 40,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
          <Text style={{ color: c.fg, fontSize: 20, fontWeight: 'bold', flex: 1 }}>
            {t('settings.title')}
          </Text>
        </View>
        <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 500 }}>
          <AutoRandomSection
            isAutoRandomMode={roomData.isAutoRandomMode}
            randomFilters={roomData.randomFilters}
            onAutoRandomChange={setAutoRandomMode}
            onFilterChange={(f) => setRandomFilters(f as Partial<{ genre: Genre; type: SingerType; tone: Tone }>)}
          />
          <QueueSection
            dragDropEnabled={roomData.dragDropEnabled}
            requesterPromptEnabled={roomData.requesterPromptEnabled}
            guestCanRemove={roomData.guestCanRemove}
            onDragDropChange={setDragDropEnabled}
            onRequesterPromptChange={setRequesterPromptEnabled}
            onGuestCanRemoveChange={setGuestCanRemove}
          />
          <AIMcSection
            isMCEnabled={roomData.isMCEnabled}
            aiScoringEnabled={roomData.aiScoringEnabled}
            mcVoice={roomData.mcVoice}
            onMCEnabledChange={setMCEnabled}
            onAiScoringChange={setAiScoringEnabled}
            onMcVoiceChange={setMcVoice}
          />
          <ThemeSection />
          <RoomSection roomCode={roomCode} />
        </ScrollView>
      </View>
    </View>
  );
}
