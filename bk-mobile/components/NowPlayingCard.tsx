import { View, Text, Image, TouchableOpacity } from 'react-native';
import { Mic, Play, Pause } from 'lucide-react-native';
import type { YouTubeVideo } from '@bs-kara/shared';

interface NowPlayingCardProps {
  song: YouTubeVideo | null;
  isPlaying: boolean;
  onToggle: () => void;
}

export function NowPlayingCard({ song, isPlaying, onToggle }: NowPlayingCardProps) {
  if (!song) return null;

  return (
    <View
      testID="now-playing-card"
      className="flex-row items-center gap-3 mx-4 mb-3 p-3 bg-[#0e1c1c] border border-[#008b8b] rounded-2xl"
    >
      <Mic size={16} color="#008b8b" />
      <Image
        source={{ uri: song.thumbnail }}
        className="w-12 h-9 rounded-lg bg-[#152a2a]"
        resizeMode="cover"
      />
      <View className="flex-1 gap-0.5">
        <Text className="text-[#e0ffff] text-sm font-semibold" numberOfLines={1}>
          {song.title}
        </Text>
        {song.requesterName ? (
          <Text className="text-[#7aa8a8] text-xs">{song.requesterName}</Text>
        ) : null}
      </View>
      <TouchableOpacity onPress={onToggle} activeOpacity={0.7} className="p-2">
        {isPlaying ? <Pause size={20} color="#40e0d0" /> : <Play size={20} color="#40e0d0" />}
      </TouchableOpacity>
    </View>
  );
}
