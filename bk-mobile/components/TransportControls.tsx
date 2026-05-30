import { View, TouchableOpacity } from 'react-native';
import { Play, Pause, SkipBack, SkipForward } from 'lucide-react-native';
import { useColors } from '@/hooks/useColors';

interface TransportControlsProps {
  isPlaying: boolean;
  onPlayPause: () => void;
  onPrev: () => void;
  onNext: () => void;
}

export function TransportControls({ isPlaying, onPlayPause, onPrev, onNext }: TransportControlsProps) {
  const c = useColors();
  return (
    <View className="flex-row items-center justify-center gap-8 py-4">
      <TouchableOpacity testID="prev-button" onPress={onPrev} activeOpacity={0.7} className="p-3">
        <SkipBack size={28} color={c.muted} />
      </TouchableOpacity>
      <TouchableOpacity
        testID="play-pause-button"
        onPress={onPlayPause}
        activeOpacity={0.7}
        className="w-16 h-16 rounded-full items-center justify-center"
        style={{ backgroundColor: c.brand }}
      >
        {isPlaying
          ? <Pause size={28} color="#fff" />
          : <Play size={28} color="#fff" />}
      </TouchableOpacity>
      <TouchableOpacity testID="next-button" onPress={onNext} activeOpacity={0.7} className="p-3">
        <SkipForward size={28} color={c.muted} />
      </TouchableOpacity>
    </View>
  );
}
