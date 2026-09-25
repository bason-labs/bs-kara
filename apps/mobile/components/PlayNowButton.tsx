import { View, TouchableOpacity } from 'react-native';
import { PlayCircle } from 'lucide-react-native';
import { useColors } from '@/hooks/useColors';

interface PlayNowButtonProps {
  videoId: string;
  currentPlayingId?: string | null;
  onPress: () => void;
  isHost: boolean;
}

// Compact icon button that promotes a queued song to currentPlaying
// immediately. Returns null when the caller is not a host (guests cannot
// reorder playback) or when the row is already the currently-playing song
// (no-op guard — the button would do nothing meaningful, and showing it
// would confuse the user).
//
// Sizing follows the web's mobile breakpoint: always-visible 40×40
// rounded-full with bg-surface-2 (#1f3a3a). There is no hover-reveal
// state on native — the button is always rendered when visible.
//
// Touch isolation: the component is wrapped in a View with
// pointerEvents='box-none' so the outer DraggableFlatList row's
// long-press drag gesture is not intercepted by this button's hit area
// (per project memory feedback_reanimated_pointer_events).
export function PlayNowButton({
  videoId,
  currentPlayingId,
  onPress,
  isHost,
}: PlayNowButtonProps) {
  const c = useColors();
  if (!isHost) return null;
  if (currentPlayingId === videoId) return null;

  return (
    <View pointerEvents="box-none">
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.7}
        accessibilityLabel="Play now"
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: c.brand,
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <PlayCircle size={20} color="#fff" strokeWidth={2.2} />
      </TouchableOpacity>
    </View>
  );
}
