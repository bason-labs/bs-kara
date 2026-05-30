import { useEffect, useRef } from 'react';
import React from 'react';
import {
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Sparkles, X } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

export interface MCAnnouncementOverlayProps {
  // 'tv' not used in mobile but kept for parity; mobile always uses 'phone' sizing
  variant: 'tv' | 'phone';
  title: string;
  requesterName?: string;
  mcText?: string;
  // When provided, renders a close button in the top-right corner of the overlay.
  // Required in FullscreenPlayer because the top bar is hidden while the MC gate
  // is active.
  onClose?: () => void;
}

export function MCAnnouncementOverlay({
  title,
  requesterName,
  mcText,
  onClose,
}: MCAnnouncementOverlayProps): React.ReactElement {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  // Opacity pulse animation for the "preparing" state (replaces CSS animate-pulse)
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (mcText) {
      // Stop pulsing once MC text has arrived
      pulseAnim.stopAnimation();
      pulseAnim.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.35,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [mcText, pulseAnim]);

  return (
    <View style={styles.container}>
      {onClose && (
        <TouchableOpacity
          onPress={onClose}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={t('player.closeFullscreen')}
          style={[styles.closeButton, { top: Math.max(8, insets.top) }]}
        >
          <X size={20} color="#ffffff" strokeWidth={2.4} />
        </TouchableOpacity>
      )}

      {/* "AI MC is talking" pill */}
      <View style={styles.pill}>
        <Sparkles size={12} color="#f9a8d4" />
        <Text style={styles.pillText}>{t('aiMc.announcing')}</Text>
      </View>

      {/* Song title */}
      <Text style={styles.title} numberOfLines={3}>
        {title}
      </Text>

      {/* Requester name */}
      {requesterName && (
        <Text style={styles.requester}>
          {t('requester.tvLabel')}{' '}
          <Text style={styles.requesterName}>{requesterName}</Text>
        </Text>
      )}

      {/* MC text or "preparing" pulse */}
      {mcText ? (
        <Text style={styles.mcText}>"{mcText}"</Text>
      ) : (
        <Animated.Text style={[styles.preparing, { opacity: pulseAnim }]}>
          {t('aiMc.preparing')}
        </Animated.Text>
      )}
    </View>
  );
}

// Colors sourced from DarkColors in constants/colors.ts plus pink tones that
// mirror the web's bg-pink-500/20 / border-pink-400/40 / text-pink-200 classes.
const PINK_200 = '#fbcfe8';
const PINK_BADGE_BG = 'rgba(236, 72, 153, 0.2)'; // pink-500/20
const PINK_BADGE_BORDER = 'rgba(244, 114, 182, 0.4)'; // pink-400/40
const GRAY_300 = '#d1d5db';
const GRAY_400 = '#9ca3af';
const BRAND_GRADIENT_START = '#008b8b';

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 8,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 16,
  },
  closeButton: {
    position: 'absolute',
    right: 12,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    // Gradient approximated with a single brand color since RN View
    // does not support CSS gradients natively.
    backgroundColor: BRAND_GRADIENT_START,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: PINK_BADGE_BG,
    borderWidth: 1,
    borderColor: PINK_BADGE_BORDER,
  },
  pillText: {
    color: PINK_200,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
    textAlign: 'center',
  },
  requester: {
    fontSize: 14,
    color: PINK_200,
    textAlign: 'center',
  },
  requesterName: {
    color: '#ffffff',
    fontWeight: '600',
  },
  mcText: {
    fontSize: 12,
    color: GRAY_300,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  preparing: {
    fontSize: 12,
    color: GRAY_400,
    textAlign: 'center',
  },
});
