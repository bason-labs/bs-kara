import { useEffect, useState } from 'react';
import { AccessibilityInfo, View } from 'react-native';
import Animated, {
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  useAnimatedStyle,
} from 'react-native-reanimated';

interface BarProps { delay: number; minH: number; maxH: number; color: string; }

function Bar({ delay, minH, maxH, color }: BarProps) {
  const h = useSharedValue(minH);
  useEffect(() => {
    const timer = setTimeout(() => {
      h.value = withRepeat(
        withSequence(withTiming(maxH, { duration: 300 }), withTiming(minH, { duration: 300 })),
        -1, false,
      );
    }, delay);
    return () => clearTimeout(timer);
  }, [delay, minH, maxH, h]);
  const style = useAnimatedStyle(() => ({ height: h.value }));
  return <Animated.View testID="eq-bar" style={[{ width: 3, borderRadius: 1.5, backgroundColor: color }, style]} />;
}

interface EQBarsProps { color?: string; }

export function EQBars({ color = '#7df9ff' }: EQBarsProps) {
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => { AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion); }, []);
  if (reduceMotion) {
    return (
      <View testID="eq-bars-static" style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: 20 }}>
        {[6, 14, 10, 16].map((h, i) => (
          <View key={i} testID="eq-bar" style={{ width: 3, height: h, borderRadius: 1.5, backgroundColor: color }} />
        ))}
      </View>
    );
  }
  return (
    <View testID="eq-bars" style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: 20 }}>
      <Bar delay={0}   minH={6} maxH={16} color={color} />
      <Bar delay={120} minH={6} maxH={18} color={color} />
      <Bar delay={80}  minH={6} maxH={12} color={color} />
      <Bar delay={200} minH={6} maxH={20} color={color} />
    </View>
  );
}
