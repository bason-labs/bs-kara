import { useEffect } from 'react';
import { View, Text, AccessibilityInfo } from 'react-native';
import Animated, {
  useSharedValue, withRepeat, withSequence, withTiming, useAnimatedStyle,
} from 'react-native-reanimated';

interface TopBarProps { roomCode: string; }

export function TopBar({ roomCode }: TopBarProps) {
  const scale = useSharedValue(1);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      if (!reduced) {
        scale.value = withRepeat(
          withSequence(withTiming(0.6, { duration: 1100 }), withTiming(1, { duration: 1100 })),
          -1, false,
        );
      }
    });
  }, [scale]);

  const dotStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 10 }}>
      <Text style={{ fontSize: 18, fontWeight: '600', color: '#e0ffff', letterSpacing: -0.3 }}>BS Kara</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#0e1c1c', borderWidth: 1, borderColor: '#1f3a3a', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
        <Animated.View style={[{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#40e0d0' }, dotStyle]} />
        <Text style={{ fontSize: 12, color: '#7aa8a8' }}>{roomCode}</Text>
      </View>
    </View>
  );
}
