import { View, Text, Image, TouchableOpacity } from 'react-native';
import type { YouTubeVideo } from '@bs-kara/shared';

interface SongResultItemProps {
  video: YouTubeVideo;
  onAdd: () => void;
  added: boolean;
}

export function SongResultItem({ video, onAdd, added }: SongResultItemProps) {
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
        className="px-3 py-2 rounded-full border border-[#008b8b]"
        style={{ opacity: added ? 0.6 : 1 }}
      >
        <Text className="text-[#008b8b] text-xs font-semibold">
          {added ? 'Đã thêm' : '+ Thêm'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}
