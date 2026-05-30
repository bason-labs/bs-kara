import { useEffect } from 'react';
import { View, Text, AccessibilityInfo } from 'react-native';
import Animated, {
  useSharedValue, withRepeat, withSequence, withTiming, useAnimatedStyle,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useColors } from '@/hooks/useColors';

interface TopBarProps { roomCode: string; }

export function TopBar({ roomCode }: TopBarProps) {
  const c = useColors();
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
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 16, paddingVertical: 12 }}>

      {/* Left: gradient BS icon + Kara wordmark */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <LinearGradient
          colors={[c.gradientStart, c.gradientMid, c.gradientEnd]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={{ width: 34, height: 34, borderRadius: 9,
            alignItems: 'center', justifyContent: 'center' }}
        >
          <Text style={{ fontSize: 13, fontWeight: '800', color: '#fff', letterSpacing: -0.5 }}>BS</Text>
        </LinearGradient>
        <Text style={{ fontSize: 20, fontWeight: '700', color: c.fg, letterSpacing: -0.3 }}>Kara</Text>
      </View>

      {/* Right: PHÒNG + room code pill */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6,
        backgroundColor: c.surface, borderWidth: 1, borderColor: c.border,
        borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 }}>
        <Animated.View pointerEvents="none"
          style={[{ width: 6, height: 6, borderRadius: 3, backgroundColor: c.accent }, dotStyle]} />
        <Text style={{ fontSize: 10, fontWeight: '600', color: c.muted,
          letterSpacing: 1, textTransform: 'uppercase' }}>Phòng</Text>
        <Text style={{ fontSize: 13, fontWeight: '700', color: c.fg, letterSpacing: 0.5 }}>{roomCode}</Text>
      </View>
    </View>
  );
}
