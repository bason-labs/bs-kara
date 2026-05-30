import { useEffect, useState } from 'react';
import {
  Modal,
  View,
  TouchableOpacity,
  Text,
  SafeAreaView,
  AccessibilityInfo,
  useWindowDimensions,
} from 'react-native';
import * as ScreenOrientation from 'expo-screen-orientation';
import AsyncStorage from '@react-native-async-storage/async-storage';
import YoutubeIframe from 'react-native-youtube-iframe';
import { X } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { MCAnnouncementOverlay } from '@/components/MCAnnouncementOverlay';

const ROTATE_HINT_KEY = 'bsk_seenRotateHint';

interface FullscreenPlayerProps {
  videoId: string;
  isPlaying: boolean;
  onClose: () => void;
  // MC gate props — when isMcGated is true the video is suppressed and the
  // MCAnnouncementOverlay is shown instead.  The overlay's onClose is wired
  // to the same onClose so the user can still leave fullscreen mid-announcement.
  isMcGated?: boolean;
  mcTitle?: string;
  mcRequesterName?: string;
  mcText?: string;
}

export function FullscreenPlayer({
  videoId,
  isPlaying,
  onClose,
  isMcGated = false,
  mcTitle,
  mcRequesterName,
  mcText,
}: FullscreenPlayerProps) {
  const { t } = useTranslation();
  const [showHint, setShowHint] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const { height, width } = useWindowDimensions();
  const playerWidth = Math.max(width, height);
  const playerHeight = Math.min(width, height);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((val) => {
      if (mounted) setReduceMotion(val);
    });
    void ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE_RIGHT).catch(() => {});
    AsyncStorage.getItem(ROTATE_HINT_KEY).then((seen) => {
      if (!seen && mounted) {
        setShowHint(true);
        void AsyncStorage.setItem(ROTATE_HINT_KEY, '1');
      }
    });
    return () => {
      mounted = false;
      void ScreenOrientation.unlockAsync().catch(() => {});
    };
  }, []);

  return (
    <Modal
      animationType={reduceMotion ? 'none' : 'slide'}
      statusBarTranslucent
      presentationStyle="overFullScreen"
      onRequestClose={onClose}
    >
      <View
        style={{ flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' }}
      >
        {/* Suppress the iframe while the MC is gated so the song audio doesn't
            bleed through during the announcement. */}
        {!isMcGated && (
          <YoutubeIframe
            videoId={videoId}
            height={playerHeight}
            width={playerWidth}
            play={isPlaying}
            webViewStyle={{ backgroundColor: '#000' }}
          />
        )}

        {/* MC overlay: rendered over the black background. The top bar is hidden
            while the Modal is open, so we pass onClose to give the user an escape. */}
        {isMcGated && mcTitle && (
          <MCAnnouncementOverlay
            variant="phone"
            title={mcTitle}
            requesterName={mcRequesterName}
            mcText={mcText}
            onClose={onClose}
          />
        )}

        {/* Close button is only shown when the MC overlay is NOT active; when it
            IS active, MCAnnouncementOverlay renders its own close button. */}
        {!isMcGated && (
          <SafeAreaView style={{ position: 'absolute', top: 0, right: 0 }}>
            <TouchableOpacity
              onPress={onClose}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Đóng"
              style={{
                margin: 12,
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: 'rgba(0,0,0,0.6)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <X size={22} color="#e0ffff" />
            </TouchableOpacity>
          </SafeAreaView>
        )}

        {showHint && !isMcGated && (
          <View
            style={{
              position: 'absolute',
              bottom: 32,
              alignSelf: 'center',
              backgroundColor: 'rgba(0,0,0,0.7)',
              borderRadius: 12,
              paddingHorizontal: 16,
              paddingVertical: 10,
            }}
          >
            <Text style={{ color: '#e0ffff', fontSize: 13 }}>
              {t('player.rotateHint', '↻ Xoay điện thoại')}
            </Text>
          </View>
        )}
      </View>
    </Modal>
  );
}
