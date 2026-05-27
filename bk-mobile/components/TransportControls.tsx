import { View, TouchableOpacity } from 'react-native';
import { Play, Pause, SkipBack, SkipForward } from 'lucide-react-native';

interface TransportControlsProps {
  isPlaying: boolean;
  onPlayPause: () => void;
  onPrev: () => void;
  onNext: () => void;
}

export function TransportControls({ isPlaying, onPlayPause, onPrev, onNext }: TransportControlsProps) {
  return (
    <View className="flex-row items-center justify-center gap-8 py-4">
      <TouchableOpacity testID="prev-button" onPress={onPrev} activeOpacity={0.7} className="p-3">
        <SkipBack size={28} color="#7aa8a8" />
      </TouchableOpacity>
      <TouchableOpacity
        testID="play-pause-button"
        onPress={onPlayPause}
        activeOpacity={0.7}
        className="w-16 h-16 rounded-full bg-[#008b8b] items-center justify-center"
      >
        {isPlaying
          ? <Pause size={28} color="#e0ffff" />
          : <Play size={28} color="#e0ffff" />}
      </TouchableOpacity>
      <TouchableOpacity testID="next-button" onPress={onNext} activeOpacity={0.7} className="p-3">
        <SkipForward size={28} color="#7aa8a8" />
      </TouchableOpacity>
    </View>
  );
}
