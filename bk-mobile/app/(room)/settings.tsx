// bk-mobile/app/(room)/settings.tsx
import { View, Text, TouchableOpacity, ScrollView, SafeAreaView } from 'react-native';
import { useTranslation } from 'react-i18next';
import { LogOut } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { getAuth, signOut } from 'firebase/auth';
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

export default function SettingsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { resolvedTheme } = useTheme();
  const c = resolvedTheme === 'dark' ? DarkColors : LightColors;
  const {
    roomData, roomCode, isHost,
    setAutoRandomMode, setRandomFilters, setDragDropEnabled,
    setRequesterPromptEnabled, setMCEnabled, setAiScoringEnabled,
    setMcVoice, setGuestCanRemove,
  } = useRoomContext();

  const handleLogout = async () => {
    await signOut(getAuth());
    router.replace('/');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
      <View
        style={{
          paddingHorizontal: 16,
          paddingVertical: 12,
          borderBottomWidth: 1,
          borderBottomColor: c.border,
        }}
      >
        <Text style={{ color: c.fg, fontSize: 18, fontWeight: '700' }}>
          {t('settings.title')}
        </Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 4, paddingBottom: 48, paddingTop: 4 }}
      >
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

        {isHost && (
          <View
            style={{
              marginTop: 32,
              marginHorizontal: 12,
              borderTopWidth: 1,
              borderTopColor: c.border,
              paddingTop: 16,
            }}
          >
            <TouchableOpacity
              onPress={() => void handleLogout()}
              activeOpacity={0.7}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
                paddingHorizontal: 12,
                paddingVertical: 12,
                borderRadius: 12,
              }}
            >
              <LogOut size={16} color={c.danger} />
              <Text style={{ color: c.danger, fontSize: 14 }}>
                {t('header.leaveButton')}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
