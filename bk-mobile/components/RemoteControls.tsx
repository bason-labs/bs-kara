import { View, TouchableOpacity } from 'react-native';
import { Pause, Play, SkipBack, SkipForward } from 'lucide-react-native';

interface RemoteControlsProps {
  isPlaying: boolean;
  hasHistory: boolean;
  hasQueue: boolean;
  onPlayPause: () => void;
  onPrev: () => void;
  onNext: () => void;
}

export function RemoteControls({
  isPlaying,
  hasHistory,
  hasQueue,
  onPlayPause,
  onPrev,
  onNext,
}: RemoteControlsProps) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 32,
        paddingVertical: 16,
      }}
    >
      <View pointerEvents={hasHistory ? 'auto' : 'none'}>
        <TouchableOpacity
          testID="prev-button"
          onPress={hasHistory ? onPrev : undefined}
          activeOpacity={0.7}
          accessibilityRole="button"
          style={[{ padding: 12 }, !hasHistory && { opacity: 0.3 }]}
        >
          <SkipBack size={28} color="#7aa8a8" />
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        testID="play-pause-button"
        onPress={onPlayPause}
        activeOpacity={0.7}
        accessibilityRole="button"
        style={{
          width: 64,
          height: 64,
          borderRadius: 32,
          backgroundColor: '#008b8b',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {isPlaying ? <Pause size={28} color="#e0ffff" /> : <Play size={28} color="#e0ffff" />}
      </TouchableOpacity>

      <View pointerEvents={hasQueue ? 'auto' : 'none'}>
        <TouchableOpacity
          testID="next-button"
          onPress={hasQueue ? onNext : undefined}
          activeOpacity={0.7}
          accessibilityRole="button"
          style={[{ padding: 12 }, !hasQueue && { opacity: 0.3 }]}
        >
          <SkipForward size={28} color="#7aa8a8" />
        </TouchableOpacity>
      </View>
    </View>
  );
}
