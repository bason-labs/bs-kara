import { useEffect, useRef, useState } from 'react';
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
import { useRoomContext } from '@/context/RoomContext';
import { useMCPlayer } from '@/hooks/useMCPlayer';
import { MCAnnouncementOverlay } from '@/components/MCAnnouncementOverlay';
import { useColors } from '@/hooks/useColors';

const ROTATE_HINT_KEY = 'bsk_seenRotateHint';

interface FullscreenPlayerProps {
  videoId: string;
  isPlaying: boolean;
  onClose: () => void;
}

export function FullscreenPlayer({ videoId, isPlaying, onClose }: FullscreenPlayerProps) {
  const { t } = useTranslation();
  const { roomData, setIsPlaying } = useRoomContext();
  const { currentPlaying, isMCEnabled, mcVoice } = roomData;
  const c = useColors();

  const [showHint, setShowHint] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  // Local play state — starts from the Firebase value but flips to true
  // immediately when MC finishes, without waiting for Firebase round-trip.
  const [shouldPlay, setShouldPlay] = useState(isPlaying);
  const { width, height } = useWindowDimensions();
  // useWindowDimensions updates after the orientation lock fires.
  // In landscape: width > height → fills the screen at the correct aspect.
  const playerWidth = width;
  const playerHeight = height;

  // MC is fully owned here. This component only mounts when fullscreen is open,
  // so ready=true avoids any ready-prop race that caused immediate gate closure.
  const { isMcGated, mcText } = useMCPlayer({
    isMCEnabled,
    currentPlaying: currentPlaying ?? null,
    ready: true,
    mcVoice,
  });

  // Keep shouldPlay in sync with Firebase isPlaying (for pause from other controls).
  useEffect(() => {
    console.log('[FS] isPlaying prop changed:', isPlaying, '→ setShouldPlay');
    setShouldPlay(isPlaying);
  }, [isPlaying]);

  // Kick-play: when MC gate drops (true → false), flip shouldPlay immediately
  // and also write to Firebase so other devices stay in sync.
  const prevMcGatedRef = useRef(false);
  useEffect(() => {
    console.log('[FS] isMcGated effect: prev=', prevMcGatedRef.current, 'now=', isMcGated, 'shouldPlay=', shouldPlay);
    if (prevMcGatedRef.current && !isMcGated) {
      console.log('[FS] MC gate dropped → setShouldPlay(true), setIsPlaying(true)');
      setShouldPlay(true);
      void setIsPlaying(true);
    }
    prevMcGatedRef.current = isMcGated;
  }, [isMcGated, setIsPlaying]); // shouldPlay intentionally omitted — read at fire time via closure

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
      <View style={{ flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' }}>
        {/* Always mounted so the WebView initialises during the MC overlay.
            play=false keeps it audio-silent while isMcGated; the MC overlay
            sits above it in z-order. When isMcGated drops, play flips true
            on an already-ready player — no fresh-mount timing race. */}
        <YoutubeIframe
          videoId={videoId}
          height={playerHeight}
          width={playerWidth}
          play={!isMcGated && shouldPlay}
          webViewStyle={{ backgroundColor: '#000' }}
          forceAndroidAutoplay
          onReady={() => console.log('[YT] playerReady fired. isMcGated=', isMcGated, 'shouldPlay=', shouldPlay, 'play=', !isMcGated && shouldPlay)}
          onChangeState={(state: string) => console.log('[YT] stateChange:', state, '| isMcGated=', isMcGated, 'shouldPlay=', shouldPlay)}
        />

        {isMcGated && currentPlaying && (
          <MCAnnouncementOverlay
            variant="phone"
            title={currentPlaying.title}
            requesterName={currentPlaying.requesterName}
            mcText={mcText ?? undefined}
            onClose={onClose}
          />
        )}

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
              <X size={22} color="#fff" />
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
            <Text style={{ color: c.fg, fontSize: 13 }}>
              {t('player.rotateHint', '↻ Xoay điện thoại')}
            </Text>
          </View>
        )}
      </View>
    </Modal>
  );
}
