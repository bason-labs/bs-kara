import { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { QrCode } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useCurrentHost } from '@/hooks/useCurrentHost';

const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL ?? '';
const CODE_LENGTH = 4;

type JoinError = 'room_not_found' | 'subscription_expired' | 'guests_not_allowed' | 'error' | null;

export default function JoinScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { profile, loading: hostLoading } = useCurrentHost();
  const inputRef = useRef<TextInput>(null);
  const [code, setCode] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<JoinError>(null);

  async function handleJoin(roomCode: string) {
    if (roomCode.length < CODE_LENGTH || isJoining) return;
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

  function handleCodeChange(text: string) {
    const digits = text.replace(/\D/g, '').slice(0, CODE_LENGTH);
    setCode(digits);
    setError(null);
    if (digits.length >= CODE_LENGTH) handleJoin(digits);
  }

  function getErrorMessage(): string | null {
    if (error === 'room_not_found') return t('home.invalidCode');
    if (error === 'subscription_expired') return 'Phòng này không còn hoạt động.';
    if (error === 'guests_not_allowed') return 'Phòng này không cho phép khách tham gia tự do.';
    if (error === 'error') return 'Đã xảy ra lỗi, vui lòng thử lại.';
    return null;
  }

  const errorMsg = getErrorMessage();
  const canSubmit = code.length >= CODE_LENGTH && !isJoining;

  return (
    <SafeAreaView className="flex-1 bg-[#06100f]">
      {/* Theme toggle */}
      <View className="absolute top-12 right-4 z-10">
        <ThemeToggle />
      </View>

      <View className="flex-1 items-center justify-center px-6">
        {/* Header */}
        <View className="items-center mb-8">
          <Text className="text-xs uppercase tracking-[4px] text-[#7aa8a8] mb-2">
            {t('home.appHeading')}
          </Text>
          <Text className="text-4xl font-bold text-[#40e0d0] mb-3">
            {t('home.wordmark')}
          </Text>
          <Text className="text-sm text-[#7aa8a8] text-center">
            {t('home.tagline')}
          </Text>
        </View>

        {/* Primary CTA — "Go to my room" if logged in, else "Login / Create room" */}
        {hostLoading ? (
          <View className="w-full py-4 items-center mb-4">
            <ActivityIndicator color="#40e0d0" size="small" />
          </View>
        ) : (
          <TouchableOpacity
            onPress={() => {
              if (profile) {
                router.replace({ pathname: '/(room)/search', params: { roomCode: profile.roomCode } });
              } else {
                router.push('/register' as never);
              }
            }}
            activeOpacity={0.8}
            className="w-full rounded-full overflow-hidden mb-4"
          >
            <LinearGradient
              colors={['#008b8b', '#006d6f', '#0d98ba']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              className="py-4 items-center"
            >
              <Text className="text-[#e0ffff] font-semibold text-base tracking-wide">
                {profile ? t('auth.goToMyRoom') : t('auth.loginOrRegister')}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        )}

        {/* Divider */}
        <View className="flex-row items-center gap-3 w-full mb-4">
          <View className="flex-1 h-px bg-[#1f3a3a]" />
          <Text className="text-xs text-[#7aa8a8] uppercase tracking-widest">
            {t('auth.orDivider')}
          </Text>
          <View className="flex-1 h-px bg-[#1f3a3a]" />
        </View>

        {/* Join card */}
        <View className="w-full bg-[#0e1c1c] border border-[#1f3a3a] rounded-3xl px-6 py-6 gap-5"
          style={{ shadowColor: '#008b8b', shadowOpacity: 0.15, shadowRadius: 20, elevation: 8 }}
        >
          {/* Label */}
          <Text className="text-xs uppercase tracking-[4px] text-[#7aa8a8]">
            {t('home.roomCodeLabel')}
          </Text>

          {/* OTP boxes */}
          <Pressable onPress={() => inputRef.current?.focus()} className="flex-row gap-3 justify-center">
            {Array.from({ length: CODE_LENGTH }).map((_, i) => {
              const char = code[i] ?? '';
              const isActive = !isJoining && (
                i === code.length || (i === CODE_LENGTH - 1 && code.length === CODE_LENGTH)
              );
              return (
                <View
                  key={i}
                  className="w-14 h-16 rounded-2xl bg-[#152a2a] items-center justify-center"
                  style={{
                    borderWidth: 2,
                    borderColor: isActive ? '#40e0d0' : char ? '#2a5050' : '#1f3a3a',
                  }}
                >
                  <Text className="text-[#e0ffff] text-2xl font-bold">
                    {char}
                  </Text>
                </View>
              );
            })}
          </Pressable>

          {/* Hidden input */}
          <TextInput
            ref={inputRef}
            value={code}
            onChangeText={handleCodeChange}
            keyboardType="number-pad"
            maxLength={CODE_LENGTH}
            autoFocus
            style={{ position: 'absolute', opacity: 0, width: 1, height: 1 }}
            editable={!isJoining}
          />

          {/* Error */}
          {errorMsg && (
            <Text className="text-xs text-[#ff5f6d] text-center">{errorMsg}</Text>
          )}

          {/* Join button */}
          <TouchableOpacity
            onPress={() => handleJoin(code)}
            disabled={!canSubmit}
            activeOpacity={0.8}
            className="w-full rounded-full overflow-hidden"
            style={{ opacity: canSubmit ? 1 : 0.4 }}
          >
            <LinearGradient
              colors={canSubmit ? ['#008b8b', '#006d6f', '#0d98ba'] : ['#152a2a', '#152a2a', '#152a2a']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              className="py-3.5 items-center"
            >
              <Text className="text-[#e0ffff] font-semibold text-sm tracking-wide">
                {isJoining ? 'Đang kiểm tra…' : t('home.joinButton')}
              </Text>
            </LinearGradient>
          </TouchableOpacity>

          {/* QR tip */}
          <View className="flex-row items-center justify-center gap-2">
            <QrCode size={13} color="#7aa8a8" />
            <Text className="text-xs text-[#7aa8a8]">{t('home.qrTip')}</Text>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}
