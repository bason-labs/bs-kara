import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useRoomGate } from '@/hooks/useRoomGate';

export default function GateScreen() {
  const router = useRouter();
  const { activeRoomCode, isLoading } = useRoomGate();

  useEffect(() => {
    if (isLoading) return;
    if (activeRoomCode) {
      router.replace({ pathname: '/(room)', params: { roomCode: activeRoomCode } });
    } else {
      router.replace('/join');
    }
  }, [isLoading, activeRoomCode, router]);

  return (
    <View className="flex-1 items-center justify-center bg-[#06100f]">
      <ActivityIndicator color="#008b8b" size="large" />
    </View>
  );
}
