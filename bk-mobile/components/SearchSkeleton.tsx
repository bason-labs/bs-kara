import { useEffect, useRef } from 'react';
import { Animated, View } from 'react-native';

const ROW_COUNT = 8;

function SkeletonRow({ delay }: { delay: number }) {
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.4, duration: 700, delay, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [opacity, delay]);

  return (
    <Animated.View
      testID="skeleton-row"
      style={{ opacity, flexDirection: 'row', alignItems: 'center', gap: 12,
        paddingHorizontal: 16, paddingVertical: 10,
        borderBottomWidth: 1, borderBottomColor: '#1f3a3a' }}
    >
      <View style={{ width: 72, height: 44, borderRadius: 6, backgroundColor: '#152a2a' }} />
      <View style={{ flex: 1, gap: 6 }}>
        <View style={{ height: 12, borderRadius: 4, backgroundColor: '#1f3a3a', width: '75%' }} />
        <View style={{ height: 10, borderRadius: 4, backgroundColor: '#152a2a', width: '45%' }} />
      </View>
      <View style={{ width: 60, height: 30, borderRadius: 999, backgroundColor: '#1f3a3a' }} />
    </Animated.View>
  );
}

export function SearchSkeleton() {
  return (
    <View>
      {Array.from({ length: ROW_COUNT }, (_, i) => (
        <SkeletonRow key={i} delay={i * 100} />
      ))}
    </View>
  );
}
