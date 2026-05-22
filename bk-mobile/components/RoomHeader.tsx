import { View, Text, TouchableOpacity } from 'react-native'; // View used in center cluster
import { LogOut, Settings } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';

interface RoomHeaderProps {
  roomCode: string;
  onLeave: () => void;
  onSettings?: () => void;
}

export function RoomHeader({ roomCode, onLeave, onSettings }: RoomHeaderProps) {
  const { t } = useTranslation();
  return (
    <View className="flex-row items-center justify-between px-4 pt-4 pb-2">
      {/* Left — leave */}
      <TouchableOpacity onPress={onLeave} activeOpacity={0.7} className="p-2 -ml-2">
        <LogOut size={20} color="#7aa8a8" />
      </TouchableOpacity>

      {/* Center — PHÒNG + room code pill */}
      <View className="flex-row items-center gap-2">
        <Text className="text-[10px] uppercase tracking-[4px] text-[#7aa8a8]">
          {t('header.roomLabel')}
        </Text>
        <LinearGradient
          colors={['#008b8b', '#006d6f', '#0d98ba']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4 }}
        >
          <Text className="text-white text-sm font-bold tracking-[4px]">
            {roomCode}
          </Text>
        </LinearGradient>
      </View>

      {/* Right — settings (invisible spacer when not provided) */}
      <TouchableOpacity
        onPress={onSettings}
        disabled={!onSettings}
        activeOpacity={0.7}
        style={{ padding: 8, marginRight: -8, opacity: onSettings ? 1 : 0 }}
      >
        <Settings size={20} color="#7aa8a8" />
      </TouchableOpacity>
    </View>
  );
}
