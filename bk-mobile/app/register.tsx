import { View, Text, SafeAreaView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ArrowLeft } from 'lucide-react-native';
import { GradientButton } from '@/components/GradientButton';

const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL ?? '';

export default function RegisterScreen() {
  const { t } = useTranslation();
  const router = useRouter();

  return (
    <SafeAreaView className="flex-1 bg-[#06100f]">
      {/* Back */}
      <TouchableOpacity
        onPress={() => router.back()}
        activeOpacity={0.7}
        className="flex-row items-center gap-2 px-4 pt-4 pb-2"
      >
        <ArrowLeft size={20} color="#7aa8a8" />
        <Text className="text-[#7aa8a8] text-sm">{t('auth.back')}</Text>
      </TouchableOpacity>

      <View className="flex-1 items-center justify-center px-6 gap-8">
        <View className="items-center gap-3">
          <Text className="text-3xl font-bold text-[#40e0d0]">{t('auth.title')}</Text>
          <Text className="text-sm text-[#7aa8a8] text-center">{t('auth.subtitle')}</Text>
        </View>

        <View className="w-full items-center gap-4">
          <Text className="text-[#7aa8a8] text-sm text-center">
            Tính năng đăng nhập chủ phòng đang được phát triển cho ứng dụng di động.{'\n'}
            Vui lòng dùng trình duyệt để đăng ký và quản lý phòng.
          </Text>

          <GradientButton
            label={`Mở ${API_BASE.replace('https://', '')}`}
            onPress={() => {
              // TODO: open web browser to registration page
            }}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}
