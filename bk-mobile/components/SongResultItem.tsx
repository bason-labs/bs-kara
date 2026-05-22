import { View, Text, Image, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { YouTubeVideo } from '@bs-kara/shared';

interface SongResultItemProps {
  video: YouTubeVideo;
  onAdd: () => void;
  added: boolean;
}

export function SongResultItem({ video, onAdd, added }: SongResultItemProps) {
  const { t } = useTranslation();
  return (
    <View className="flex-row items-center gap-3 px-4 py-3 border-b border-[#1f3a3a]">
      <Image
        source={{ uri: video.thumbnail }}
        className="w-16 h-12 rounded-lg bg-[#152a2a]"
        resizeMode="cover"
      />
      <View className="flex-1 gap-1">
        <Text className="text-[#e0ffff] text-sm font-medium" numberOfLines={2}>
          {video.title}
        </Text>
        <Text className="text-[#7aa8a8] text-xs">{video.channel}</Text>
      </View>
      <TouchableOpacity
        testID="add-button"
        onPress={onAdd}
        disabled={added}
        activeOpacity={0.7}
        style={{
          borderWidth: 1,
          borderColor: '#008b8b',
          borderRadius: 999,
          paddingHorizontal: 12,
          paddingVertical: 6,
          opacity: added ? 0.6 : 1,
        }}
      >
        <Text style={{ color: '#008b8b', fontSize: 12, fontWeight: '600' }}>
          {added ? t('search.addedToQueueButton') : '+ Thêm'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}
