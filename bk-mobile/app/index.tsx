import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useRoomGate } from '@/hooks/useRoomGate';
import { useColors } from '@/hooks/useColors';

export default function GateScreen() {
  const router = useRouter();
  const { activeRoomCode, isLoading } = useRoomGate();
  const c = useColors();

  useEffect(() => {
    if (isLoading) return;
    if (activeRoomCode) {
      router.replace({ pathname: '/(room)/search', params: { roomCode: activeRoomCode } });
    } else {
      router.replace('/join');
    }
  }, [isLoading, activeRoomCode, router]);

  return (
    <View className="flex-1 items-center justify-center" style={{ backgroundColor: c.bg }}>
      <ActivityIndicator color={c.brand} size="large" />
    </View>
  );
}
