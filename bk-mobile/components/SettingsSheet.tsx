import { View, Text, Switch, TouchableOpacity, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRoomContext } from '@/context/RoomContext';

interface SettingsSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsSheet({ isOpen, onClose }: SettingsSheetProps) {
  const { t } = useTranslation();
  const {
    roomData,
    setDragDropEnabled,
    setRequesterPromptEnabled,
    setMCEnabled,
    setGuestCanRemove,
  } = useRoomContext();

  if (!isOpen) return null;

  return (
    <View className="absolute inset-0" style={{ zIndex: 100 }}>
      {/* Backdrop */}
      <TouchableOpacity
        className="flex-1"
        style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
        activeOpacity={1}
        onPress={onClose}
      />
      {/* Sheet */}
      <View className="bg-[#0e1c1c] rounded-t-3xl px-6 pt-6 pb-10">
        <View className="flex-row items-center mb-6">
          <Text className="text-[#e0ffff] text-xl font-bold flex-1">{t('settings.title')}</Text>
        </View>
        <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 400 }}>
          {/* Queue section */}
          <Text className="text-[#7aa8a8] text-xs uppercase tracking-widest mb-3">
            {t('settings.sections.queue')}
          </Text>

          <View className="flex-row items-center justify-between py-3 border-b border-[#1f3a3a]">
            <View style={{ flex: 1, marginRight: 12 }}>
              <Text className="text-[#e0ffff] text-sm">{t('settings.dragDropLabel')}</Text>
              <Text className="text-[#7aa8a8] text-xs">{t('settings.dragDropHint')}</Text>
            </View>
            <Switch
              testID="toggle-drag-drop"
              value={roomData.dragDropEnabled}
              onValueChange={(v) => setDragDropEnabled(v)}
              trackColor={{ false: '#1f3a3a', true: '#008b8b' }}
              thumbColor="#e0ffff"
            />
          </View>

          <View className="flex-row items-center justify-between py-3 border-b border-[#1f3a3a]">
            <View style={{ flex: 1, marginRight: 12 }}>
              <Text className="text-[#e0ffff] text-sm">{t('settings.requesterPromptLabel')}</Text>
              <Text className="text-[#7aa8a8] text-xs">{t('settings.requesterPromptHint')}</Text>
            </View>
            <Switch
              value={roomData.requesterPromptEnabled}
              onValueChange={(v) => setRequesterPromptEnabled(v)}
              trackColor={{ false: '#1f3a3a', true: '#008b8b' }}
              thumbColor="#e0ffff"
            />
          </View>

          <View className="flex-row items-center justify-between py-3 border-b border-[#1f3a3a]">
            <View style={{ flex: 1, marginRight: 12 }}>
              <Text className="text-[#e0ffff] text-sm">{t('settings.guestCanRemoveLabel')}</Text>
              <Text className="text-[#7aa8a8] text-xs">{t('settings.guestCanRemoveHint')}</Text>
            </View>
            <Switch
              value={roomData.guestCanRemove}
              onValueChange={(v) => setGuestCanRemove(v)}
              trackColor={{ false: '#1f3a3a', true: '#008b8b' }}
              thumbColor="#e0ffff"
            />
          </View>

          {/* AI MC section */}
          <Text className="text-[#7aa8a8] text-xs uppercase tracking-widest mt-5 mb-3">
            {t('settings.sections.aiMc')}
          </Text>
          <View className="flex-row items-center justify-between py-3 border-b border-[#1f3a3a]">
            <View style={{ flex: 1, marginRight: 12 }}>
              <Text className="text-[#e0ffff] text-sm">{t('settings.aiMcLabel')}</Text>
              <Text className="text-[#7aa8a8] text-xs">{t('settings.aiMcHint')}</Text>
            </View>
            <Switch
              value={roomData.isMCEnabled}
              onValueChange={(v) => setMCEnabled(v)}
              trackColor={{ false: '#1f3a3a', true: '#008b8b' }}
              thumbColor="#e0ffff"
            />
          </View>
        </ScrollView>
      </View>
    </View>
  );
}
