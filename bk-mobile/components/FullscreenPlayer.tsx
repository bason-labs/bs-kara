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

const ROTATE_HINT_KEY = 'bsk_seenRotateHint';

interface FullscreenPlayerProps {
  videoId: string;
  isPlaying: boolean;
  onClose: () => void;
}

export function FullscreenPlayer({ videoId, isPlaying, onClose }: FullscreenPlayerProps) {
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
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE_RIGHT);
    AsyncStorage.getItem(ROTATE_HINT_KEY).then((seen) => {
      if (!seen && mounted) {
        setShowHint(true);
        void AsyncStorage.setItem(ROTATE_HINT_KEY, '1');
      }
    });
    return () => {
      mounted = false;
      void ScreenOrientation.unlockAsync();
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
        <YoutubeIframe
          videoId={videoId}
          height={playerHeight}
          width={playerWidth}
          play={isPlaying}
          webViewStyle={{ backgroundColor: '#000' }}
        />
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
        {showHint && (
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
