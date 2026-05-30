import { useEffect, useRef } from 'react';
import { Animated, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { CheckCircle2 } from 'lucide-react-native';
import { useColors } from '@/hooks/useColors';

const TAB_BAR_HEIGHT = 52;
const AUTO_DISMISS_MS = 1800;

interface AddedToastProps {
  onDismiss: () => void;
}

export function AddedToast({ onDismiss }: AddedToastProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const c = useColors();
  const translateY = useRef(new Animated.Value(40)).current;

  useEffect(() => {
    Animated.timing(translateY, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
    const timer = setTimeout(onDismiss, AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [onDismiss, translateY]);

  const bottom = TAB_BAR_HEIGHT + insets.bottom + 4;

  return (
    <Animated.View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        bottom,
        left: 0,
        right: 0,
        alignItems: 'center',
        transform: [{ translateY }],
      }}
    >
      <TouchableOpacity
        testID="toast-card"
        onPress={onDismiss}
        activeOpacity={0.9}
        accessibilityRole="alert"
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            backgroundColor: c.surface,
            borderWidth: 1,
            borderColor: c.border,
            borderRadius: 999,
            paddingHorizontal: 14,
            paddingVertical: 10,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.4,
            shadowRadius: 12,
            elevation: 6,
          }}
        >
          <CheckCircle2 size={14} color={c.brand} />
          <Text style={{ color: c.fg, fontSize: 13, fontWeight: '500' }}>
            {t('toast.addedToQueue')}
          </Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}
