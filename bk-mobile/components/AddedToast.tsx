import { useEffect, useRef } from 'react';
import { Animated, Image, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { CheckCircle2 } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { YouTubeVideo } from '@bs-kara/shared';

const TAB_BAR_HEIGHT = 64;

interface AddedToastProps {
  video: YouTubeVideo;
  onViewQueue: () => void;
  onDismiss: () => void;
}

export function AddedToast({ video, onViewQueue, onDismiss }: AddedToastProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(60)).current;

  useEffect(() => {
    Animated.timing(translateY, {
      toValue: 0, duration: 250,
      useNativeDriver: true,
    }).start();
    const timer = setTimeout(onDismiss, 2500);
    return () => clearTimeout(timer);
  }, [onDismiss, translateY]);

  const bottom = TAB_BAR_HEIGHT + insets.bottom + 8;

  return (
    <Animated.View style={{ position: 'absolute', bottom, left: 12, right: 12,
      transform: [{ translateY }] }}>
      <TouchableOpacity testID="toast-card" onPress={onDismiss} activeOpacity={0.9}>
        <View style={{ backgroundColor: '#0e1c1c', borderWidth: 1, borderColor: '#1f3a3a',
          borderRadius: 16, padding: 10, flexDirection: 'row',
          alignItems: 'center', gap: 10,
          shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.6, shadowRadius: 16 }}>
          <Image source={{ uri: video.thumbnail }}
            style={{ width: 52, height: 34, borderRadius: 6, backgroundColor: '#152a2a' }}
            resizeMode="cover" />
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 3 }}>
              <CheckCircle2 size={11} color="#008b8b" />
              <Text style={{ fontSize: 10, color: '#008b8b', fontWeight: '700',
                letterSpacing: 0.5, textTransform: 'uppercase', lineHeight: 12 }}>
                {t('addedToast.added')}
              </Text>
            </View>
            <Text style={{ fontSize: 12, color: '#e0ffff', fontWeight: '500', lineHeight: 14 }}
              numberOfLines={1}>
              {video.title}
            </Text>
          </View>
          <LinearGradient colors={['#008b8b', '#0d98ba']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={{ borderRadius: 999, flexShrink: 0 }}>
            <TouchableOpacity onPress={onViewQueue} activeOpacity={0.8}
              style={{ height: 32, paddingHorizontal: 12,
                alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 11, color: '#fff', fontWeight: '600',
                lineHeight: 13, includeFontPadding: false }}>
                {t('addedToast.viewQueue')}
              </Text>
            </TouchableOpacity>
          </LinearGradient>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}
