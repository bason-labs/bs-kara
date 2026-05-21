import { useState } from 'react';
import { View, Text, SafeAreaView } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { OTPInput } from '@/components/OTPInput';
import { GradientButton } from '@/components/GradientButton';

const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL ?? '';

type JoinError = 'room_not_found' | 'subscription_expired' | 'error' | null;

export default function JoinScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [code, setCode] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<JoinError>(null);

  async function handleJoin(roomCode: string) {
    if (roomCode.length < 4 || isJoining) return;
    setError(null);
    setIsJoining(true);
    try {
      const res = await fetch(`${API_BASE}/api/room-access?roomCode=${roomCode}`);
      const data = (await res.json()) as { allowed: boolean; reason: string };
      if (!data.allowed) {
        setError((data.reason as JoinError) ?? 'error');
        return;
      }
      router.replace({ pathname: '/(room)/search', params: { roomCode } });
    } catch {
      setError('error');
    } finally {
      setIsJoining(false);
    }
  }

  function getErrorMessage(): string | null {
    if (error === 'room_not_found') return t('home.invalidCode');
    if (error === 'subscription_expired') return 'Phòng này không còn hoạt động.';
    if (error === 'error') return 'Đã xảy ra lỗi, vui lòng thử lại.';
    return null;
  }

  const errorMsg = getErrorMessage();

  return (
    <SafeAreaView className="flex-1 bg-[#06100f]">
      <View className="flex-1 items-center justify-center px-6 gap-8">
        <View className="items-center gap-2">
          <Text className="text-3xl font-bold text-[#e0ffff]">BS Kara</Text>
          <Text className="text-sm text-[#7aa8a8] text-center">{t('home.subtitle')}</Text>
        </View>
        <OTPInput
          value={code}
          onChange={setCode}
          onComplete={handleJoin}
          ariaLabel={t('home.roomCodeLabel')}
        />
        {errorMsg && (
          <Text className="text-sm text-[#ff5f6d] text-center">{errorMsg}</Text>
        )}
        <GradientButton
          label={isJoining ? '…' : t('home.joinButton')}
          onPress={() => handleJoin(code)}
          disabled={code.length < 4 || isJoining}
        />
      </View>
    </SafeAreaView>
  );
}
